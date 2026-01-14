// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IEvents {
    // 房产上链
    event PropertyListed(uint256 indexed id, string name, address landlord);
    // 房产开始融资
    event InvestmentStarted(uint256 indexed id, uint256 sharePrice, uint256 endTime);
    // 房产股份被购买
    event SharesBought(uint256 indexed id, address investor, uint256 shares);
    // 房产融资结束
    event InvestmentFinished(uint256 indexed id, uint256 totalSold);
    // 房产开放租赁
    event PropertyRented(uint256 indexed id, address tenant, uint256 months);
    // 租客支付租金
    event RentClaimed(uint256 indexed id, address user, uint256 amount);
    // 周期结束，租金分账
    event CycleEnded(uint256 indexed id);
}
