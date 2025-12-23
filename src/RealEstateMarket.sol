// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libraries/DataTypes.sol";

contract RealEstateMarket {
    using DataTypes for DataTypes.Property;

    mapping(address => uint256) public balances; // 可提余额
    mapping(uint256 => DataTypes.Property) public properties;
    mapping(uint256 => mapping(address => DataTypes.UserInfo)) public userInfo;
    uint256[] public allPropertyIds;
    
    event PropertyListed(uint256 indexed propertyId, string name, address indexed landlord);
    event BalanceFunded(address indexed user, uint256 amount); 
    event Withdrawn(address indexed user, uint256 amount);

    function getAllPropertyIds() external view returns (uint256[] memory) {
        return allPropertyIds;
    }

    // 1. 房东上链
    function listProperty(string memory _name, string memory _physicalAddress, uint256 _area, string memory _propertyType, string memory _phone) external returns (uint256) {
        uint256 randomHash = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, allPropertyIds.length)));
        uint256 newId = (randomHash % 9000000000000000) + 1000000000000000;
        
        DataTypes.Property storage p = properties[newId];
        p.name = _name; p.physicalAddress = _physicalAddress; p.area = _area; p.propertyType = _propertyType; p.landlordPhone = _phone;
        p.landlord = payable(msg.sender);
        p.status = DataTypes.PropertyStatus.Idle;

        userInfo[newId][msg.sender].shares = 100;
        allPropertyIds.push(newId);
        
        // ✅ [新增] 房东也是股东，加入名单
        p.shareholders.push(msg.sender);

        emit PropertyListed(newId, _name, msg.sender);
        return newId;
    }

    // 2. 开启融资
    function startInvestment(uint256 _propertyId, uint256 _sharePrice, uint256 _durationMonths) external payable {
        DataTypes.Property storage p = properties[_propertyId];
        require(msg.sender == p.landlord, "Not landlord");
        require(msg.value > 0, "Deposit required"); 
        p.sharePrice = _sharePrice;
        p.investmentEndTime = block.timestamp + (_durationMonths * 30 days);
        p.landlordDeposit = msg.value;
        p.status = DataTypes.PropertyStatus.InInvestment; 
    }

    // 3. 投资者买入
    function buyShares(uint256 _propertyId, uint256 _shareAmount) external payable {
        DataTypes.Property storage p = properties[_propertyId];
        require(msg.value == p.sharePrice * _shareAmount, "Amount error");

        // ✅ [新增] 如果是新股东，加入名单
        if (userInfo[_propertyId][msg.sender].shares == 0) {
            p.shareholders.push(msg.sender);
        }

        // 融资款给房东
        balances[p.landlord] += msg.value;
        emit BalanceFunded(p.landlord, msg.value);

        p.totalSharesSold += _shareAmount;
        userInfo[_propertyId][p.landlord].shares -= _shareAmount;
        userInfo[_propertyId][msg.sender].shares += _shareAmount;
    }

    // 4. 结束融资
    function finishInvestment(uint256 _propertyId) external {
        properties[_propertyId].status = DataTypes.PropertyStatus.InvestEnded; 
    }

    // 5. 上架出租
    function listForRent(uint256 _propertyId, uint256 _monthlyRent) external {
        DataTypes.Property storage p = properties[_propertyId];
        p.monthlyRent = _monthlyRent;
        p.status = DataTypes.PropertyStatus.OpenForRent; 
    }

    // 6. 租客租房 (✅ 核心修改：自动分账)
    function rentProperty(uint256 _propertyId, uint256 _months) external payable {
        DataTypes.Property storage p = properties[_propertyId];
        require(p.status == DataTypes.PropertyStatus.OpenForRent, "Not open");
        
        uint256 totalRent = p.monthlyRent * _months;
        uint256 deposit = p.monthlyRent * 3; 
        require(msg.value >= totalRent + deposit, "Not enough");

        // 1. 存押金
        p.rentDeposit = deposit; 
        
        // 2. ✅ 立即分租金 (Payment Splitting)
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

        p.rentStartTime = block.timestamp;
        p.rentEndTime = block.timestamp + (_months * 30 days);
        p.tenant = msg.sender;
        p.status = DataTypes.PropertyStatus.Rented;
    }

    // ❌ [已删除] claimRentIncome (因为租金已经自动发了，不需要手动领了)

    // 7. 退还押金
    function withdrawDeposits(uint256 _propertyId) external {
        DataTypes.Property storage p = properties[_propertyId];
        if (msg.sender == p.landlord && p.landlordDeposit > 0) {
            uint256 amt = p.landlordDeposit;
            p.landlordDeposit = 0; balances[p.landlord] += amt; 
        }
        if (msg.sender == p.tenant && p.rentDeposit > 0) {
            uint256 amt = p.rentDeposit;
            p.rentDeposit = 0; balances[p.tenant] += amt; 
            p.status = DataTypes.PropertyStatus.Idle;
            p.tenant = address(0);
        }
    }

    function burnProperty(uint256 _propertyId) external {
        DataTypes.Property storage p = properties[_propertyId];
        
        // 权限检查
        require(msg.sender == p.landlord, "Not landlord");
        require(p.status == DataTypes.PropertyStatus.Idle, "Must be Idle");
        
        // 安全检查：确保份额是完整的 (100%)，防止误删有投资者的房产
        require(userInfo[_propertyId][msg.sender].shares == 100, "Shares not full");

        // 删除数据 (这将把该 ID 对应的 struct 重置为默认值，landlord 变为 address(0))
        delete properties[_propertyId];
        
        // 注意：allPropertyIds 数组里依然有这个 ID，但我们在前端会过滤掉无效数据
    }

    function withdraw(uint256 _amount) external {
        require(balances[msg.sender] >= _amount, "Insufficient");
        balances[msg.sender] -= _amount; 
        payable(msg.sender).transfer(_amount);
    }
}