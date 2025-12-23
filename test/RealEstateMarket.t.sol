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

    function testFullCycle() public {
        // 1. 房东上链
        vm.startPrank(landlord);
        uint256 pid = market.listProperty("Seaview Villa", "123 Ocean Dr", 100, "Villa", "123456");
        console.log("Property ID:", pid);
        
        // 2. 开启融资
        market.startInvestment{value: 3 ether}(pid, 0.1 ether, 3); 
        vm.stopPrank();

        // 3. 投资者购买 40份 (4 ETH)
        vm.startPrank(investor);
        market.buyShares{value: 4 ether}(pid, 40);
        vm.stopPrank();

        // 4. 结束融资并上架
        vm.startPrank(landlord);
        market.finishInvestment(pid);
        market.listForRent(pid, 1 ether); // 月租 1 ETH
        vm.stopPrank();

        // ==========================================
        // 5. 租客租房 & 自动分账测试 (核心修改)
        // ==========================================
        
        // 记录租房前，投资者的合约余额（应该是 0）
        uint256 invBalBefore = market.balances(investor);
        console.log("Investor Balance Before Rent:", invBalBefore);

        vm.startPrank(tenant);
        // 租金 4 ETH + 押金 3 ETH = 7 ETH
        // 支付瞬间，合约会自动把租金分给股东
        market.rentProperty{value: 7 ether}(pid, 4);
        vm.stopPrank();

        // 记录租房后，投资者的合约余额
        uint256 invBalAfter = market.balances(investor);
        console.log("Investor Balance After Rent:", invBalAfter);

        // 验证：余额必须自动增加！
        // 投资者持有 40%，总租金 4 ETH，理应分得 1.6 ETH
        assertGt(invBalAfter, invBalBefore);
        assertEq(invBalAfter, 1.6 ether); 

        // ==========================================
        // 6. 提现到钱包 (Withdraw)
        // ==========================================
        vm.startPrank(investor);
        uint256 walletBefore = investor.balance;
        
        // 把自动分到的钱提现
        market.withdraw(invBalAfter);
        
        uint256 walletAfter = investor.balance;
        
        // 验证钱包收到了钱
        assertEq(walletAfter, walletBefore + invBalAfter);
        vm.stopPrank();
    }
}