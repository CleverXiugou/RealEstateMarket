// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library DataTypes {
    // 房产的几个状态
    enum PropertyStatus { 
        Idle,           // 0: 闲置中
        InInvestment,   // 1: 融资中
        InvestEnded,    // 2: 锁定融资
        OpenForRent,    // 3: 正在招租
        Rented          // 4: 已经租出
    }
    // 投资者信息
    struct UserInfo {
        // 自己持有的股份
        uint256 shares;
        // 已提取的租金
        uint256 withdrawnRent;
    }
    // 房产信息
    struct Property {
        string name;
        string physicalAddress;
        uint256 area;
        // 房产类型，如公寓、别墅等
        string propertyType; 
        string landlordPhone;
        // 房东地址，可以提现
        address payable landlord;
        PropertyStatus status;
        
        // 每一股的价格，在融资时使用
        uint256 sharePrice;
        // 融资截止时间
        uint256 investmentEndTime;
        // 房东押金，现有公式：押金 = 股价 * 20 股 * 月份数
        uint256 landlordDeposit;
        // 已售股份总数
        uint256 totalSharesSold;
        
        // 每月的租金
        uint256 monthlyRent;
        // 租房押金
        uint256 rentDeposit;
        // 租赁开始和结束时间
        uint256 rentStartTime;
        uint256 rentEndTime;
        // 租客账户地址
        address tenant;

        // 股东名单 (用于租金自动分账)
        address[] shareholders;
        // 投资者权益周期
        uint256 rightsDuration;
    }
}