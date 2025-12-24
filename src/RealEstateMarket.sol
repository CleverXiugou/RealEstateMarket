// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libraries/DataTypes.sol";

contract RealEstateMarket {
    using DataTypes for DataTypes.Property;

    // 用户可提余额
    mapping(address => uint256) public balances;
    // 房产tokenID 到 房产详细信息
    mapping(uint256 => DataTypes.Property) public properties;
    // 房产ID 到 用户地址 到 用户信息
    mapping(uint256 => mapping(address => DataTypes.UserInfo)) public userInfo;
    // 合约中所有房产ID列表
    uint256[] public allPropertyIds;
    
    // Events
    event PropertyListed(uint256 indexed propertyId, string name, address indexed landlord);
    event BalanceFunded(address indexed user, uint256 amount); 
    event Withdrawn(address indexed user, uint256 amount);

    // 获取所有房产ID
    function getAllPropertyIds() external view returns (uint256[] memory) {
        return allPropertyIds;
    }

    // 房东把房产上链
    function listProperty(string memory _name, string memory _physicalAddress, uint256 _area, string memory _propertyType, string memory _phone) external returns (uint256) {
        // 保证房产tokenID是16位的随机数字（没有检查是否存在重复）
        uint256 randomHash = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, allPropertyIds.length)));
        uint256 newId = (randomHash % 9000000000000000) + 1000000000000000;
        
        // 存储房产信息
        DataTypes.Property storage p = properties[newId];
        p.name = _name; p.physicalAddress = _physicalAddress; p.area = _area; p.propertyType = _propertyType; p.landlordPhone = _phone;
        // 房东默认为房产上链者的地址
        p.landlord = payable(msg.sender);
        // 房产初始状态为闲置中
        p.status = DataTypes.PropertyStatus.Idle;

        // 房东默认持股100份
        userInfo[newId][msg.sender].shares = 100;
        // 记录房产ID
        allPropertyIds.push(newId);
        
        // 房东也是股东，加入股东名单
        p.shareholders.push(msg.sender);

        emit PropertyListed(newId, _name, msg.sender);
        return newId;
    }

    // 开启融资
    function startInvestment(uint256 _propertyId, uint256 _sharePrice, uint256 _durationMonths) external payable {
        
        DataTypes.Property storage p = properties[_propertyId];
        // 权限检查
        require(msg.sender == p.landlord, "Not landlord");
        // 押金价格检查
        require(msg.value > 0, "Deposit required"); 
        // 输入房产的股价和融资期限
        p.sharePrice = _sharePrice;
        p.investmentEndTime = block.timestamp + (_durationMonths * 30 days);
        // 存押金
        p.landlordDeposit = msg.value;
        // 房产进入融资状态
        p.status = DataTypes.PropertyStatus.InInvestment; 
    }

    // 投资者买入
    function buyShares(uint256 _propertyId, uint256 _shareAmount) external payable {
        DataTypes.Property storage p = properties[_propertyId];
        // 资金校验
        require(msg.value == p.sharePrice * _shareAmount, "Amount error");

        // 如果是新股东，加入名单
        if (userInfo[_propertyId][msg.sender].shares == 0) {
            p.shareholders.push(msg.sender);
        }

        // 融资款给房东，可以直接提现
        balances[p.landlord] += msg.value;
        emit BalanceFunded(p.landlord, msg.value);

        // 更新股份售出信息
        p.totalSharesSold += _shareAmount;
        // 房东股份减少，投资者股份增加
        userInfo[_propertyId][p.landlord].shares -= _shareAmount;
        userInfo[_propertyId][msg.sender].shares += _shareAmount;
    }

    // 结束融资
    function finishInvestment(uint256 _propertyId) external {
        // 更新房产状态
        properties[_propertyId].status = DataTypes.PropertyStatus.InvestEnded; 
    }

    // 上架出租
    function listForRent(uint256 _propertyId, uint256 _monthlyRent) external {
        DataTypes.Property storage p = properties[_propertyId];
        // 权限检查
        require(msg.sender == p.landlord, "Not landlord");
        // 输入月租金
        p.monthlyRent = _monthlyRent;
        // 更新房产状态：开始出租
        p.status = DataTypes.PropertyStatus.OpenForRent; 
    }

    // 租客租房 
    function rentProperty(uint256 _propertyId, uint256 _months) external payable {
        DataTypes.Property storage p = properties[_propertyId];
        // 状态检查
        require(p.status == DataTypes.PropertyStatus.OpenForRent, "Not open");
        
        // 计算总租金和押金
        uint256 totalRent = p.monthlyRent * _months;
        uint256 deposit = p.monthlyRent * 3; 
        // 检查支付金额
        require(msg.value >= totalRent + deposit, "Not enough");

        // 存押金
        p.rentDeposit = deposit; 
        
        // 立即分租金 
        // 遍历所有股东，按比例发钱
        for (uint i = 0; i < p.shareholders.length; i++) {
            address shareholder = p.shareholders[i];
            uint256 share = userInfo[_propertyId][shareholder].shares;
            
            if (share > 0) {
                // 分红 = 总租金 * (持股数 / 100)
                uint256 dividend = (totalRent * share) / 100;
                balances[shareholder] += dividend; // 直接进入可提余额
                emit BalanceFunded(shareholder, dividend);
            }
        }
        
        // 设置租赁时间和租客
        p.rentStartTime = block.timestamp;
        p.rentEndTime = block.timestamp + (_months * 30 days);
        p.tenant = msg.sender;
        p.status = DataTypes.PropertyStatus.Rented;
    }

    // 退还押金
    function withdrawDeposits(uint256 _propertyId) external {
        DataTypes.Property storage p = properties[_propertyId];
        // 权限检查
        if (msg.sender == p.landlord && p.landlordDeposit > 0) {
            uint256 amt = p.landlordDeposit;
            p.landlordDeposit = 0; balances[p.landlord] += amt; 
        }
        // 租客退还押金
        if (msg.sender == p.tenant && p.rentDeposit > 0) {
            uint256 amt = p.rentDeposit;
            p.rentDeposit = 0; balances[p.tenant] += amt; 
            // 重置房产状态
            p.status = DataTypes.PropertyStatus.Idle;
            // 清空租客信息
            p.tenant = address(0);
        }
    }

    // 销毁房产
    function burnProperty(uint256 _propertyId) external {
        DataTypes.Property storage p = properties[_propertyId];
        
        // 权限检查
        require(msg.sender == p.landlord, "Not landlord");
        // 只有当房产空闲时才能销毁
        require(p.status == DataTypes.PropertyStatus.Idle, "Must be Idle");
        
        // 安全检查：确保份额是完整的 (100%)，防止误删有投资者的房产
        require(userInfo[_propertyId][msg.sender].shares == 100, "Shares not full");

        // 删除数据 (这将把该 ID 对应的 struct 重置为默认值，landlord 变为 address(0))
        delete properties[_propertyId];
        
        // 注意：allPropertyIds 数组里依然有这个 ID，但我们在前端会过滤掉无效数据
    }
    
    // 自定义提取合约中的资金
    function withdraw(uint256 _amount) external {
        // 提取金额不可大于存款数
        require(balances[msg.sender] >= _amount, "Insufficient");
        balances[msg.sender] -= _amount; 
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Transfer failed");
    }
}