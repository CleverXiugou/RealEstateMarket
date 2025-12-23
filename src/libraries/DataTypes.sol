// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library DataTypes {
    enum PropertyStatus { 
        Idle,           // 0: 闲置
        InInvestment,   // 1: 融资中
        InvestEnded,    // 2: 准备出租
        OpenForRent,    // 3: 待出租
        Rented          // 4: 出租中
    }

    struct UserInfo {
        uint256 shares;
        uint256 withdrawnRent;
    }

    struct Property {
        string name;
        string physicalAddress;
        uint256 area;
        string propertyType;
        string landlordPhone;
        address payable landlord;
        PropertyStatus status;
        
        uint256 sharePrice;
        uint256 investmentEndTime;
        uint256 landlordDeposit;
        uint256 totalSharesSold;
        
        uint256 monthlyRent;
        uint256 rentDeposit;
        uint256 rentStartTime;
        uint256 rentEndTime;
        address tenant;

        // ✅ [新增] 股东名单 (用于租金自动分账)
        address[] shareholders;
    }
}