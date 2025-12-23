// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RealEstateMarket.sol";

contract DeployRealEstate is Script {
    function run() external {
        // 【关键修改】：从环境变量读取私钥
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // 使用读取到的私钥开始广播
        vm.startBroadcast(deployerPrivateKey);

        new RealEstateMarket();

        vm.stopBroadcast();
    }
}