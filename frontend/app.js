const { useState, useEffect } = React;

function App() {
    const [provider, setProvider] = useState(null);
    const [contract, setContract] = useState(null);
    const [account, setAccount] = useState("");
    const [activeTab, setActiveTab] = useState("dashboard");
    const [globalLoading, setGlobalLoading] = useState(false);
    const [allProperties, setAllProperties] = useState([]);
    
    // 资金状态
    const [myTotalDeposit, setMyTotalDeposit] = useState("0");
    const [myWithdrawable, setMyWithdrawable] = useState("0");
    
    const [toasts, setToasts] = useState([]);
    const [btnLoading, setBtnLoading] = useState({});

    const showToast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    };

    async function connectWallet() {
        if (!window.ethereum) return showToast("请安装MetaMask", "error");
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            const p = new ethers.providers.Web3Provider(window.ethereum);
            const s = p.getSigner();
            const addr = await s.getAddress();
            const config = window.AppConfig || {};
            
            if (!config.ADDRESS || !ethers.utils.isAddress(config.ADDRESS)) {
                return showToast("Config 中合约地址格式错误！", "error");
            }
            
            const c = new ethers.Contract(config.ADDRESS, config.ABI, s);
            setProvider(p); setContract(c); setAccount(addr);
            showToast("钱包连接成功");
        } catch (e) { showToast(e.message, "error"); }
    }

    function disconnectWallet() {
        setAccount(""); setContract(null); setProvider(null); setAllProperties([]); 
        setMyWithdrawable("0");
        showToast("已断开连接", "info");
    }

    async function fetchAllData() {
        if (!contract || !account) return;
        setGlobalLoading(true);
        try {
            const bal = await contract.balances(account);
            setMyWithdrawable(ethers.utils.formatEther(bal));

            const idList = await contract.getAllPropertyIds();
            const tempProps = [];
            let tempDeposit = ethers.BigNumber.from(0);

            for (let i = 0; i < idList.length; i++) {
                const id = idList[i];
                try {
                    const p = await contract.properties(id);
                    
                    // ✅ [核心修改] 过滤掉已销毁的房产 (地址为 0x000... 的)
                    if (p.landlord === ethers.constants.AddressZero) continue;

                    const u = await contract.userInfo(id, account);
                    if (p.landlord.toLowerCase() === account.toLowerCase() && p.landlordDeposit.gt(0)) tempDeposit = tempDeposit.add(p.landlordDeposit);
                    if (p.tenant.toLowerCase() === account.toLowerCase() && p.rentDeposit.gt(0)) tempDeposit = tempDeposit.add(p.rentDeposit);

                    tempProps.push({ 
                        id: id.toString(), ...p, 
                        area: p.area.toNumber(),
                        myShares: u.shares.toNumber(), 
                        myWithdrawn: u.withdrawnRent 
                    });
                } catch (e) { console.error(e); }
            }
            setAllProperties(tempProps.reverse());
            setMyTotalDeposit(ethers.utils.formatEther(tempDeposit));
        } catch (e) { console.error(e); }
        setGlobalLoading(false);
    }

    useEffect(() => { if (contract) fetchAllData(); }, [contract, account]);

    const wrapAction = async (key, fn, ...args) => {
        setBtnLoading(prev => ({ ...prev, [key]: true }));
        try {
            const tx = await fn(...args);
            showToast("交易已提交，等待确认...");
            await tx.wait();
            showToast("交易确认成功！");
            fetchAllData();
            return true;
        } catch(e) { 
            const msg = e.reason || e.message || "交易失败";
            showToast(msg.slice(0, 50) + "...", "error");
            return false;
        } finally {
            setBtnLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    const actions = {
        onList: (f) => {
            if(!f.name || !f.address || !f.area || !f.type || !f.phone) return showToast("请完整填写所有房产信息", "error");
            return wrapAction('list', contract.listProperty, f.name, f.address, f.area, f.type, f.phone);
        },
        onStartInvest: (id, sharePriceStr, rightsDuration, fundraisingDays, depositStr) => {
            if(!sharePriceStr || !depositStr) return showToast("参数错误", "error");
            const priceWei = ethers.utils.parseEther(sharePriceStr);
            const depositWei = ethers.utils.parseEther(depositStr);
            // 调用合约新接口
            wrapAction(id, contract.startInvestment, id, priceWei, rightsDuration, fundraisingDays, { value: depositWei });
        },
        // ✅ [新增] 修改房产信息
        onUpdateInfo: (id, f) => {
             if(!f.name || !f.address || !f.area || !f.type || !f.phone) return showToast("信息不全", "error");
             wrapAction(id, contract.updatePropertyBasicInfo, id, f.name, f.address, f.area, f.type, f.phone);
        },
        onLock: (id) => wrapAction(id, contract.finishInvestment, id),
        onBuy: (id, p, amt) => {
            if(!amt) return showToast("请输入购买数量", "error");
            wrapAction(id, contract.buyShares, id, amt, { value: p.mul(amt) })
        },
        onListRent: (id, f) => {
            if(!f || !f.rent) return showToast("请填写租金", "error");
            wrapAction(id, contract.listForRent, id, ethers.utils.parseEther(f.rent))
        },
        onRent: (id, mr, dep, m) => {
            if(!m) return showToast("请填写租期", "error");
            wrapAction(id, contract.rentProperty, id, m, { value: mr.mul(m).add(dep) })
        },
        onWithdrawDeposit: (id) => wrapAction(id, contract.withdrawDeposits, id),
        onWithdraw: (amount) => {
             if(!amount) return showToast("请输入金额", "error");
             wrapAction('withdraw', contract.withdraw, ethers.utils.parseEther(amount));
        },
        // ✅ [新增] 销毁房产 action
        onBurn: (id) => wrapAction(id, contract.burnProperty, id)
    };

    return (
        <div className="min-h-screen pb-12">
            <window.UI.ToastContainer toasts={toasts} />
            <nav className="bg-white shadow sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 flex justify-between h-16 items-center">
                    <div className="flex gap-8 items-center">
                        <span className="text-xl font-black text-indigo-600">RWA Pro</span>
                        <div className="hidden md:flex space-x-4 text-gray-600">
                            {['dashboard','investment','rental','explorer'].map(t => (
                                <div key={t} onClick={()=>setActiveTab(t)} className={`cursor-pointer px-3 py-2 capitalize transition ${activeTab===t?'text-indigo-600 font-bold border-b-2 border-indigo-600':'hover:text-indigo-500'}`}>
                                    {t === 'explorer' ? '🔍 Explorer' : t}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {account ? (
                            <React.Fragment>
                                <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 border border-indigo-100 shadow-sm cursor-default">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    {account.slice(0,6)}...{account.slice(-4)}
                                </div>
                                <button onClick={disconnectWallet} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all" title="退出登录">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
                                </button>
                            </React.Fragment>
                        ) : (
                            <button onClick={connectWallet} className="bg-indigo-600 text-white px-6 py-2 rounded-full text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 font-bold">连接钱包</button>
                        )}
                    </div>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto px-4 py-8">
                {!account ? (
                    <div className="text-center py-32 flex flex-col items-center animate-fade-in">
                        <div className="text-6xl mb-6">🔗</div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">欢迎来到 RWA Pro</h2>
                        <p className="text-gray-500 mb-8">请连接您的 MetaMask 钱包以开始管理现实世界资产</p>
                        <button onClick={connectWallet} className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-lg hover:bg-indigo-700 transition shadow-xl shadow-indigo-200 font-bold">立即连接</button>
                    </div>
                ) : (
                    <React.Fragment>
                        {globalLoading && <div className="fixed top-20 right-4 bg-white/90 backdrop-blur p-2 rounded shadow text-sm flex items-center gap-2 z-50"><div className="animate-spin h-3 w-3 border-2 border-indigo-600 rounded-full border-t-transparent"></div> 数据同步中...</div>}
                        
                        {activeTab === 'dashboard' && <window.Dashboard account={account} properties={allProperties} myDeposit={myTotalDeposit} myWithdrawable={myWithdrawable} loadingMap={btnLoading} {...actions} />}
                        {activeTab === 'investment' && <window.InvestmentMarket properties={allProperties} onBuy={actions.onBuy} onRefresh={fetchAllData} loadingMap={btnLoading} />}
                        {activeTab === 'rental' && <window.RentalMarket properties={allProperties} onRent={actions.onRent} onRefresh={fetchAllData} loadingMap={btnLoading} />}
                        {activeTab === 'explorer' && <window.Explorer contract={contract} properties={allProperties} loadingMap={btnLoading} />}
                    </React.Fragment>
                )}
            </main>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);