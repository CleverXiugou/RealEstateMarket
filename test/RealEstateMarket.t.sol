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

    // 辅助函数：快速创建一个处于 "已出租" 状态的房产
    function _setupRentedProperty() internal returns (uint256) {
        vm.startPrank(landlord);
        uint256 pid = market.listProperty("Test Villa", "Addr", 100, "Villa", "123");
        // 融资：股价0.1，权益12个月，窗口10天
        market.startInvestment{value: 1 ether}(pid, 0.1 ether, 12, 10);
        vm.stopPrank();

        vm.startPrank(investor);
        market.buyShares{value: 2 ether}(pid, 20); // 买20份
        vm.stopPrank();

        vm.startPrank(landlord);
        market.finishInvestment(pid);
        market.listForRent(pid, 1 ether); // 月租1 ETH
        vm.stopPrank();

        vm.startPrank(tenant);
        // 租金1*3 + 押金1*3 = 6 ETH
        market.rentProperty{value: 6 ether}(pid, 3);
        vm.stopPrank();

        return pid;
    }

    // ✅ 测试 1: 验证融资窗口期 (Days vs Months)
    function testFundraisingWindow() public {
        vm.startPrank(landlord);
        uint256 pid = market.listProperty("Window Test", "Addr", 100, "Apt", "000");

        uint256 start = block.timestamp;
        // 参数: id, price, 权益12个月, 融资7天
        market.startInvestment{value: 1 ether}(pid, 0.1 ether, 12, 7);

        (,,,,,,,, uint256 endTime,,,,,,,,,,) = market.properties(pid);

        // 验证：截止时间应该是 当前 + 7天 (而不是 7个月 或 12个月)
        assertEq(endTime, start + 7 days, "Fundraising window should be exactly 7 days");
        vm.stopPrank();
    }

    // ✅ 测试 2: 验证房东不能买自己的份额
    function testLandlordCannotBuyOwn() public {
        vm.startPrank(landlord);
        uint256 pid = market.listProperty("My House", "Addr", 100, "Apt", "000");
        market.startInvestment{value: 1 ether}(pid, 0.1 ether, 12, 10);

        // 房东尝试购买 -> 预期失败
        vm.expectRevert("Landlord cannot buy own shares");
        market.buyShares{value: 1 ether}(pid, 10);
        vm.stopPrank();
    }

    // ✅ 测试 3: 正常退房 (房东同意退款)
    function testSettlementRefund() public {
        uint256 pid = _setupRentedProperty();

        // 1. 租客申请
        vm.startPrank(tenant);
        market.requestTermination(pid);
        vm.stopPrank();

        // 验证状态变为 5 (PendingSettlement)
        (,,,,,, DataTypes.PropertyStatus status,,,,,,,,,,,,) = market.properties(pid);
        assertEq(uint256(status), 5);

        // 记录退款前余额
        uint256 balBefore = market.balances(tenant);

        // 2. 房东同意 (true)
        vm.startPrank(landlord);
        market.processSettlement(pid, true);
        vm.stopPrank();

        // 验证余额增加 (押金 3 ETH)
        uint256 balAfter = market.balances(tenant);
        assertEq(balAfter - balBefore, 3 ether, "Tenant should receive deposit back");

        // 验证状态重置为 Idle (0)
        (,,,,,, status,,,,,,,,,,,,) = market.properties(pid);
        assertEq(uint256(status), 0);
    }

    // ✅ 测试 4: 房屋损坏 (房东扣除押金)
    function testSettlementConfiscate() public {
        uint256 pid = _setupRentedProperty();

        vm.startPrank(tenant);
        market.requestTermination(pid);
        vm.stopPrank();

        uint256 balBefore = market.balances(landlord);

        // 房东拒绝 (false) -> 扣押金
        vm.startPrank(landlord);
        market.processSettlement(pid, false);
        vm.stopPrank();

        // 验证房东余额增加 (3 ETH)
        uint256 balAfter = market.balances(landlord);
        assertEq(balAfter - balBefore, 3 ether, "Landlord should receive deposit");
    }

    // ✅ 测试 5: 房东失联 -> 强制退房 (超时机制)
    function testForceTermination() public {
        uint256 pid = _setupRentedProperty();

        vm.startPrank(tenant);
        market.requestTermination(pid);

        // 立即尝试强制退房 -> 应该失败 (未超时)
        vm.expectRevert("Wait for landlord");
        market.forceTermination(pid);

        // 时间快进 4 天 (超过 3 天限制)
        vm.warp(block.timestamp + 4 days);

        // 再次尝试 -> 应该成功
        market.forceTermination(pid);
        vm.stopPrank();

        // 验证状态重置
        (,,,,,, DataTypes.PropertyStatus status,,,,,,,,,,,,) = market.properties(pid);
        assertEq(uint256(status), 0);
    }

    // ✅ 测试 6: 权益到期 -> 重置房产 (清洗股东)
    function testResetExpiredProperty() public {
        uint256 pid = _setupRentedProperty();

        // 先把租客清退，让房产变回 Idle
        vm.startPrank(tenant);
        market.requestTermination(pid);
        vm.stopPrank();
        vm.startPrank(landlord);
        market.processSettlement(pid, true);
        vm.stopPrank();

        // 此时房产是 Idle，但权益周期还没到期 (12个月)
        // 尝试重置 -> 应该失败
        vm.startPrank(landlord);
        vm.expectRevert("Rights not expired yet");
        market.resetExpiredProperty(pid);

        // 时间快进 400 天 (超过 12个月)
        vm.warp(block.timestamp + 400 days);

        // 再次重置 -> 应该成功
        market.resetExpiredProperty(pid);

        // 验证数据：
        // 1. 投资者份额应为 0
        (uint256 sharesInv,) = market.userInfo(pid, investor);
        assertEq(sharesInv, 0, "Investor shares should be wiped");

        // 2. 房东份额应为 100
        (uint256 sharesLandlord,) = market.userInfo(pid, landlord);
        assertEq(sharesLandlord, 100, "Landlord should reclaim 100%");

        vm.stopPrank();
    }

    // ✅ 测试 7: 完整生命周期 (12个月权益 = 租客A 6个月 + 空置 1个月 + 租客B 5个月)
    function testMultiTenantCycle() public {
        // --- 1. 初始设置与融资 ---
        vm.startPrank(landlord);
        uint256 pid = market.listProperty("Cycle Test", "Addr", 100, "Apt", "000");
        // 开启融资：权益周期 12 个月
        market.startInvestment{value: 1 ether}(pid, 0.1 ether, 12, 7);
        vm.stopPrank();

        // 投资者买入 20% (20份)
        vm.startPrank(investor);
        market.buyShares{value: 2 ether}(pid, 20);
        vm.stopPrank();

        // 结束融资，权益周期开始计时
        vm.startPrank(landlord);
        market.finishInvestment(pid);

        // --- 2. 第一任租客 A (租 6 个月) ---
        market.listForRent(pid, 1 ether); // 月租 1 ETH
        vm.stopPrank();

        uint256 invBalStart = market.balances(investor);
        uint256 landBalStart = market.balances(landlord);

        vm.startPrank(tenant);
        // 支付: 6个月租金(6 ETH) + 3个月押金(3 ETH) = 9 ETH
        market.rentProperty{value: 9 ether}(pid, 6);
        vm.stopPrank();

        // ⚡️ 检查收益分配 A
        // 投资者应得: 6 ETH * 20% = 1.2 ETH
        assertEq(market.balances(investor) - invBalStart, 1.2 ether, "Investor income A incorrect");
        // 房东应得: 6 ETH * 80% = 4.8 ETH
        // 注意：rentProperty 只分租金，押金存在合约里，所以这里只看租金部分
        assertEq(market.balances(landlord) - landBalStart, 4.8 ether, "Landlord income A incorrect");

        // --- 3. 租客 A 退租 (正常流程) ---
        vm.startPrank(tenant);
        market.requestTermination(pid);
        vm.stopPrank();

        vm.startPrank(landlord);
        market.processSettlement(pid, true); // 退还押金
        vm.stopPrank();

        // --- 4. 空置期 (模拟空置 1 个月) ---
        // 此时房产状态为 Idle
        vm.warp(block.timestamp + 30 days);

        // --- 5. 第二任租客 B (租 5 个月) ---
        // 为了区分，我们创建一个新租客地址
        address tenantB = address(0x99);
        vm.deal(tenantB, 100 ether);

        vm.startPrank(landlord);
        // 房东涨价了：月租 2 ETH
        market.listForRent(pid, 2 ether);
        vm.stopPrank();

        uint256 invBalInter = market.balances(investor);

        vm.startPrank(tenantB);
        // 支付: 5个月租金(10 ETH) + 3个月押金(6 ETH) = 16 ETH
        market.rentProperty{value: 16 ether}(pid, 5);
        vm.stopPrank();

        // ⚡️ 检查收益分配 B
        // 投资者应得: 5个月 * 2 ETH * 20% = 2 ETH
        assertEq(market.balances(investor) - invBalInter, 2 ether, "Investor income B incorrect");

        // --- 6. 租客 B 退租 ---
        vm.startPrank(tenantB);
        market.requestTermination(pid);
        vm.stopPrank();
        vm.startPrank(landlord);
        market.processSettlement(pid, true);
        vm.stopPrank();

        // --- 7. 权益到期重置 ---
        // 目前时间流逝：租客A(6个月操作时间可能很短) + 空置(1个月) + 租客B(5个月操作时间)
        // 实际上 rentProperty 设置了 rentEndTime，但 block.timestamp 只被 vm.warp 推动
        // 为了确保超过 12 个月的权益周期，我们需要再快进足够的时间
        // 获取权益开始时间 (index 17, 第 18 个参数)
        (,,,,,,,,,,,,,,,,, uint256 rightsStart,) = market.properties(pid);

        // 确保当前时间超过 开始时间 + 12个月
        vm.warp(rightsStart + 370 days);

        vm.startPrank(landlord);
        market.resetExpiredProperty(pid);

        // ⚡️ 最终检查：股份是否归零/回归
        (uint256 sharesInv,) = market.userInfo(pid, investor);
        assertEq(sharesInv, 0, "Investor shares should be wiped");

        (uint256 sharesLandlord,) = market.userInfo(pid, landlord);
        assertEq(sharesLandlord, 100, "Landlord should reclaim 100%");

        vm.stopPrank();
    }

    // ✅ 测试 8: 租期限制校验 (防止租客赖着不走)
    function testRentDurationLimit() public {
        // 1. 准备环境：权益周期 12 个月
        vm.startPrank(landlord);
        uint256 pid = market.listProperty("Limit Test", "Addr", 100, "Apt", "000");
        market.startInvestment{value: 1 ether}(pid, 0.1 ether, 12, 7); // 12个月权益
        vm.stopPrank();

        vm.startPrank(investor);
        market.buyShares{value: 2 ether}(pid, 20);
        vm.stopPrank();

        vm.startPrank(landlord);
        market.finishInvestment(pid); // 权益倒计时开始
        market.listForRent(pid, 1 ether);
        vm.stopPrank();

        vm.startPrank(tenant);

        // 场景 A: 试图租 13 个月 (超过权益剩余 12 个月) -> 应该失败
        vm.expectRevert("Rent exceeds rights duration");
        market.rentProperty{value: 16 ether}(pid, 13); // 13*1 + 3 = 16 ETH

        // 场景 B: 试图租 12 个月 (正好卡线) -> 应该成功
        // 12*1 + 3 = 15 ETH
        market.rentProperty{value: 15 ether}(pid, 12);

        vm.stopPrank();
    }

    // ✅ 测试 9: 验证查询函数 getMaxRentableMonths
    function testViewFunction() public {
        // 1. 准备环境
        vm.startPrank(landlord);
        uint256 pid = market.listProperty("View Test", "Addr", 100, "Apt", "000");
        market.startInvestment{value: 1 ether}(pid, 0.1 ether, 12, 7); // 权益 12 个月
        vm.stopPrank();

        // 融资阶段，权益还没开始，应该返回 0
        uint256 m0 = market.getMaxRentableMonths(pid);
        assertEq(m0, 0, "Should be 0 before investment ends");

        vm.startPrank(investor);
        market.buyShares{value: 2 ether}(pid, 20);
        vm.stopPrank();

        vm.startPrank(landlord);
        market.finishInvestment(pid); // 权益开始！
        vm.stopPrank();

        // 2. 刚开始 -> 应该剩 12 个月
        uint256 m1 = market.getMaxRentableMonths(pid);
        assertEq(m1, 12, "Should be 12 months initially");

        // 3. 时间过去 1.5 个月 -> 应该剩 10 个月 (向下取整)
        // 剩余 10.5 个月，按整月租，所以显示 10
        vm.warp(block.timestamp + 45 days);
        uint256 m2 = market.getMaxRentableMonths(pid);
        assertEq(m2, 10, "Should be 10 months after 45 days");

        // 4. 时间过去 12 个月 -> 应该剩 0
        vm.warp(block.timestamp + 330 days); // 再过 11 个月
        uint256 m3 = market.getMaxRentableMonths(pid);
        assertEq(m3, 0, "Should be 0 after expiry");
    }
}
