const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // ⚠️ 记得填入新地址

const CONTRACT_ABI = [
    "function getAllPropertyIds() view returns (uint256[])",
    "function listProperty(string _name, string _physicalAddress, uint256 _area, string _propertyType, string _phone) external returns (uint256)",
    "function startInvestment(uint256 _propertyId, uint256 _sharePrice, uint256 _rightsDurationMonths, uint256 _fundraisingDays) external payable",
    "function updatePropertyBasicInfo(uint256 _propertyId, string _name, string _physicalAddress, uint256 _area, string _propertyType, string _phone) external",
    "function finishInvestment(uint256 _propertyId) external",
    "function buyShares(uint256 _propertyId, uint256 _shareAmount) external payable",
    "function listForRent(uint256 _propertyId, uint256 _monthlyRent) external",
    "function rentProperty(uint256 _propertyId, uint256 _months) external payable",
    "function requestTermination(uint256 _propertyId) external",
    "function processSettlement(uint256 _propertyId, bool _returnDeposit) external",
    "function forceTermination(uint256 _propertyId) external",
    "function withdrawDeposits(uint256 _propertyId) external",
    "function balances(address) view returns (uint256)",
    "function withdraw(uint256) external",
    "function burnProperty(uint256 _propertyId) external",
    "function properties(uint256) view returns (string name, string physicalAddress, uint256 area, string propertyType, string landlordPhone, address landlord, uint8 status, uint256 sharePrice, uint256 investmentEndTime, uint256 landlordDeposit, uint256 totalSharesSold, uint256 monthlyRent, uint256 rentDeposit, uint256 rentStartTime, uint256 rentEndTime, address tenant, uint256 rightsDuration, uint256 rightsStartTime, uint256 tenantEndRequestTime)",
    "function userInfo(uint256, address) view returns (uint256 shares, uint256 withdrawnRent)",
];

const STATUS_MAP = ["闲置", "融资中", "准备出租", "待出租", "出租中","待结算"];
const STATUS_BADGE_COLOR = ["bg-gray-100 text-gray-700", "bg-blue-100 text-blue-700", "bg-purple-100 text-purple-700", "bg-yellow-100 text-yellow-800", "bg-green-100 text-green-700","bg-red-100 text-red-700 animate-pulse"];

window.AppConfig = { ADDRESS: CONTRACT_ADDRESS, ABI: CONTRACT_ABI, STATUS_MAP, STATUS_BADGE_COLOR };