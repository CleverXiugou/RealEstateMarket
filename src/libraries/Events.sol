// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IEvents {
    event PropertyListed(uint256 indexed id, string name, address landlord);
    event InvestmentStarted(uint256 indexed id, uint256 sharePrice, uint256 endTime);
    event SharesBought(uint256 indexed id, address investor, uint256 shares);
    event InvestmentFinished(uint256 indexed id, uint256 totalSold);
    event PropertyRented(uint256 indexed id, address tenant, uint256 months);
    event RentClaimed(uint256 indexed id, address user, uint256 amount);
    event CycleEnded(uint256 indexed id);
}