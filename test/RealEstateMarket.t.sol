// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RealEstateMarket.sol";
import "../src/libraries/DataTypes.sol";

contract RealEstateTest is Test {
    RealEstateMarket market;
    
    address landlord = address(0x1);
    address investor = address(0x2);
    address tenant = address(0x3);

    function setUp() public {
        market = new RealEstateMarket();
        vm.deal(landlord, 100 ether);
        vm.deal(investor, 100 ether);
        vm.deal(tenant, 100 ether);
    }

    // ✅ 测试 1: 成功修改信息 (Happy Path)
    function testUpdateInfoSuccess() public {
        vm.startPrank(landlord);
        // 1. 初始上链
        uint256 pid = market.listProperty("Old Name", "Old Address", 50, "Apt", "111");

        // 2. 调用修改函数
        market.updatePropertyBasicInfo(pid, "New Name", "New Address", 100, "Villa", "222");
        
        // 3. 验证链上数据是否变了
        // ⚠️ 修复关键点：这里总共需要匹配 17 个参数
        // 1.name, 2.addr, 3.area, 4.pType, 5.phone
        // 后面还有 12 个参数 (从 index 6 到 17)
        // 所以 phone 后面需要 12 个逗号
        (
            string memory name, 
            string memory addr, 
            uint256 area, 
            string memory pType, 
            string memory phone,
            ,,,,,,,,,,,// 12个逗号，确保总数是 17
        ) = market.properties(pid);

        assertEq(name, "New Name");
        assertEq(addr, "New Address");
        assertEq(area, 100);
        assertEq(pType, "Villa");
        assertEq(phone, "222");
        
        vm.stopPrank();
    }

    // ❌ 测试 2: 非房东修改 -> 应该失败
    function testUpdateFailNotLandlord() public {
        vm.startPrank(landlord);
        uint256 pid = market.listProperty("My House", "Addr", 50, "Apt", "111");
        vm.stopPrank();

        // 切换成投资者尝试修改
        vm.startPrank(investor);
        vm.expectRevert("Not landlord");
        market.updatePropertyBasicInfo(pid, "Hacker", "Hacked Addr", 999, "Tent", "000");
        vm.stopPrank();
    }

    // ❌ 测试 3: 状态不是闲置 -> 应该失败
    function testUpdateFailWrongStatus() public {
        vm.startPrank(landlord);
        uint256 pid = market.listProperty("Seaview", "Beach", 100, "Villa", "111");
        
        // 开启融资，状态变为 InInvestment (1)
        market.startInvestment{value: 1 ether}(pid, 0.1 ether, 12, 14);
        
        // 尝试修改 -> 预期被拦截
        vm.expectRevert("Must be Idle");
        market.updatePropertyBasicInfo(pid, "Desert", "Desert", 10, "Tent", "222");
        vm.stopPrank();
    }

    // ❌ 测试 4: 份额不完整 -> 应该失败
    function testUpdateFailSharesNotFull() public {
        // 1. 房东上链 & 融资
        vm.startPrank(landlord);
        uint256 pid = market.listProperty("Shared House", "Addr", 100, "Apt", "111");
        market.startInvestment{value: 1 ether}(pid, 0.1 ether, 12, 14);
        vm.stopPrank();

        // 2. 投资者买入 20份
        vm.startPrank(investor);
        market.buyShares{value: 2 ether}(pid, 20);
        vm.stopPrank();

        // 3. 走完流程让状态回到 Idle
        vm.startPrank(landlord);
        market.finishInvestment(pid);
        market.listForRent(pid, 1 ether);
        vm.stopPrank();

        vm.startPrank(tenant);
        market.rentProperty{value: 4 ether}(pid, 1); // 租1个月
        vm.stopPrank();

        // 时间快进，租约结束
        vm.warp(block.timestamp + 32 days);

        // 结算退押金，状态重置为 Idle
        vm.startPrank(tenant);
        market.withdrawDeposits(pid); 
        vm.stopPrank();

        // 4. 此时状态是 Idle，但房东只有 80% 股份
        // 房东试图修改 -> 预期失败
        vm.startPrank(landlord);
        vm.expectRevert("Shares not full");
        market.updatePropertyBasicInfo(pid, "New Name", "Changed Addr", 200, "Villa", "222");
        vm.stopPrank();
    }
}