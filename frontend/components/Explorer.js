const { useState, useEffect } = React;

const Explorer = ({ contract, properties, loadingMap }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState("home"); // home | property | user
    const [searchResult, setSearchResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ tvl: 0, totalRent: 0, userCount: 0 });

    const { STATUS_MAP, STATUS_BADGE_COLOR } = window.AppConfig || { STATUS_MAP: [], STATUS_BADGE_COLOR: [] };

    // 初始化：计算平台总数据
    useEffect(() => {
        if (properties.length > 0) {
            const tvl = properties.reduce((acc, p) => {
                const price = p.sharePrice ? parseFloat(ethers.utils.formatEther(p.sharePrice)) : 0;
                return acc + (price * 100);
            }, 0);
            
            // 简单的用户去重统计
            const users = new Set();
            properties.forEach(p => {
                users.add(p.landlord);
                if (p.tenant && p.tenant !== ethers.constants.AddressZero) users.add(p.tenant);
            });

            setStats({
                tvl: tvl,
                totalRent: properties.reduce((acc, p) => acc + parseFloat(ethers.utils.formatEther(p.monthlyRent || 0)), 0),
                userCount: users.size
            });
        }
    }, [properties]);

    // 🔍 核心逻辑：智能搜索
    const handleSearch = async () => {
        if (!searchQuery.trim()) return Swal.fire('请输入内容', 'Token ID 或 钱包地址', 'info');
        setLoading(true);
        setSearchResult(null);

        try {
            const query = searchQuery.trim();

            // 1. 判断是否为钱包地址 (0x...)
            if (ethers.utils.isAddress(query)) {
                await fetchUserProfile(query);
                setViewMode("user");
            } 
            // 2. 判断是否为数字 ID
            else if (/^\d+$/.test(query)) {
                const property = properties.find(p => p.id === query);
                if (property) {
                    // 如果本地有基础数据，再读一下最新的 Shareholders 信息(如果有合约接口)或仅仅展示当前数据
                    // 这里我们基于现有数据做深度展示
                    setSearchResult({ type: 'property', data: property });
                    setViewMode("property");
                } else {
                    Swal.fire('未找到', `没有找到 ID 为 ${query} 的房产`, 'error');
                }
            } else {
                Swal.fire('格式错误', '请输入正确的 ID (数字) 或 地址 (0x...)', 'error');
            }
        } catch (e) {
            console.error(e);
            Swal.fire('查询失败', e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // 👤 获取用户深度画像 (需要遍历合约来查找该用户的投资)
    const fetchUserProfile = async (address) => {
        const userProfile = {
            address: address,
            landlordProps: [],
            investments: [],
            rentals: [],
            totalAssetValue: 0, // 净资产
            totalMonthlyIncome: 0 // 预计月收入
        };

        // 遍历所有房产，查找与该地址有关的记录
        // 注意：这里需要调用 contract.userInfo 来获取特定用户的份额，因为 properties prop 里只包含当前连接钱包的份额
        for (let p of properties) {
            // 1. 是房东？
            if (p.landlord.toLowerCase() === address.toLowerCase()) {
                userProfile.landlordProps.push(p);
                // 估值计算 (假设房东持有剩余份额)
                const heldShares = 100 - (p.totalSharesSold ? p.totalSharesSold.toNumber() : 0);
                const price = parseFloat(ethers.utils.formatEther(p.sharePrice));
                userProfile.totalAssetValue += heldShares * price;
            }

            // 2. 是租客？
            if (p.tenant.toLowerCase() === address.toLowerCase()) {
                userProfile.rentals.push(p);
            }

            // 3. 是投资者？ (调用合约查询)
            try {
                const info = await contract.userInfo(p.id, address);
                const shares = info.shares.toNumber();
                if (shares > 0 && p.landlord.toLowerCase() !== address.toLowerCase()) {
                    const price = parseFloat(ethers.utils.formatEther(p.sharePrice));
                    const rent = parseFloat(ethers.utils.formatEther(p.monthlyRent));
                    
                    userProfile.investments.push({ ...p, userShares: shares });
                    userProfile.totalAssetValue += shares * price;
                    
                    if (p.status === 4) { // 出租中
                        userProfile.totalMonthlyIncome += rent * (shares / 100);
                    }
                }
            } catch (e) {
                console.warn("Failed to fetch user info for property", p.id);
            }
        }
        setSearchResult({ type: 'user', data: userProfile });
    };

    // --- 子组件：房产详情视图 ---
    const PropertyDetailView = ({ data }) => {
        // 构造时间轴数据
        const steps = [
            { label: '上链确权', date: '区块时间', status: 'done' },
            { label: '融资开启', date: `${data.totalSharesSold} / 100 份`, status: data.status >= 1 ? 'done' : 'wait' },
            { label: '寻找租客', date: '待出租', status: data.status >= 3 ? 'done' : 'wait' },
            { label: '收益分红', date: data.status === 4 ? '进行中' : '-', status: data.status === 4 ? 'active' : 'wait' },
        ];

        return (
            <div className="animate-fade-in">
                <button onClick={() => setViewMode('home')} className="mb-4 text-sm text-gray-500 hover:text-indigo-600 flex items-center gap-1">← 返回搜索</button>
                
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                    {/* 头部大图/信息 */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-32 bg-white opacity-5 rounded-full blur-3xl translate-x-10 -translate-y-10"></div>
                        <div className="relative z-10 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="bg-white/20 backdrop-blur px-2 py-1 rounded text-xs font-bold">#{data.id}</span>
                                    <span className="bg-orange-500 px-2 py-1 rounded text-xs font-bold">{STATUS_MAP[data.status]}</span>
                                </div>
                                <h1 className="text-3xl font-bold mb-2">{data.name}</h1>
                                <p className="opacity-90 flex items-center gap-2">📍 {data.physicalAddress}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-sm opacity-75">当前估值</div>
                                <div className="text-3xl font-bold">Ξ {(parseFloat(ethers.utils.formatEther(data.sharePrice)) * 100).toFixed(2)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8">
                        {/* 左侧：时间轴 */}
                        <div className="col-span-1 border-r border-gray-100 pr-8">
                            <h3 className="font-bold text-gray-800 mb-6">📅 资产里程碑</h3>
                            <div className="space-y-6">
                                {steps.map((step, idx) => (
                                    <div key={idx} className="flex gap-4 relative">
                                        <div className={`w-3 h-3 rounded-full mt-1.5 z-10 ${step.status === 'done' ? 'bg-indigo-600' : step.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-200'}`}></div>
                                        {idx !== steps.length - 1 && <div className="absolute left-1.5 top-3 w-0.5 h-full bg-gray-100"></div>}
                                        <div>
                                            <h4 className={`text-sm font-bold ${step.status === 'wait' ? 'text-gray-400' : 'text-gray-800'}`}>{step.label}</h4>
                                            <p className="text-xs text-gray-500">{step.date}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 中间：股权结构 */}
                        <div className="col-span-1">
                            <h3 className="font-bold text-gray-800 mb-6">📊 股权结构</h3>
                            <div className="relative h-48 w-48 mx-auto mb-4">
                                {/* 纯 CSS 饼图模拟 (基于 conic-gradient) */}
                                <div className="w-full h-full rounded-full" 
                                     style={{
                                         background: `conic-gradient(#4f46e5 0% ${100-data.totalSharesSold}%, #e2e8f0 ${100-data.totalSharesSold}% 100%)`
                                     }}>
                                </div>
                                <div className="absolute inset-0 m-8 bg-white rounded-full flex items-center justify-center flex-col shadow-inner">
                                    <span className="text-xs text-gray-400">房东持有</span>
                                    <span className="text-xl font-bold text-indigo-600">{100 - data.totalSharesSold}%</span>
                                </div>
                            </div>
                            <div className="flex justify-between text-xs px-8">
                                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-indigo-600 rounded-full"></div> 房东</div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-200 rounded-full"></div> 投资者 ({data.totalSharesSold}%)</div>
                            </div>
                        </div>

                        {/* 右侧：财务数据 */}
                        <div className="col-span-1 bg-gray-50 rounded-2xl p-6">
                            <h3 className="font-bold text-gray-800 mb-4">💰 财务报表</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                                    <span className="text-sm text-gray-500">份额单价</span>
                                    <span className="font-mono font-bold text-gray-800">{ethers.utils.formatEther(data.sharePrice)} ETH</span>
                                </div>
                                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                                    <span className="text-sm text-gray-500">月租金收入</span>
                                    <span className="font-mono font-bold text-teal-600">+{ethers.utils.formatEther(data.monthlyRent)} ETH</span>
                                </div>
                                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                                    <span className="text-sm text-gray-500">年化收益率 (Est.)</span>
                                    <span className="font-mono font-bold text-orange-500">
                                        {data.monthlyRent > 0 ? ((data.monthlyRent * 12 * 100) / (data.sharePrice * 100)).toFixed(1) + '%' : '-'}
                                    </span>
                                </div>
                                <div className="pt-2">
                                    <span className="text-xs text-gray-400">房东地址:</span>
                                    <div className="text-xs font-mono bg-white p-2 rounded border mt-1 truncate">{data.landlord}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- 子组件：用户画像视图 ---
    const UserProfileView = ({ data }) => {
        const [activeTab, setActiveTab] = useState('assets');

        return (
            <div className="animate-fade-in">
                <button onClick={() => setViewMode('home')} className="mb-4 text-sm text-gray-500 hover:text-indigo-600 flex items-center gap-1">← 返回搜索</button>
                
                {/* 用户 Header */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row items-center gap-6">
                    <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-pink-500 rounded-full flex items-center justify-center text-3xl shadow-lg text-white">
                        👤
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                            <h2 className="text-xl font-bold text-gray-800 font-mono">{data.address.slice(0,8)}...{data.address.slice(-6)}</h2>
                            <span className="bg-indigo-50 text-indigo-600 text-[10px] px-2 py-0.5 rounded-full border border-indigo-100">Explorer View</span>
                        </div>
                        <div className="flex gap-4 justify-center md:justify-start text-sm text-gray-500">
                            {data.investments.length > 3 && <span className="flex items-center gap-1 text-orange-500">👼 天使投资人</span>}
                            {data.rentals.length > 0 && <span className="flex items-center gap-1 text-teal-500">⭐ 认证租客</span>}
                            {data.landlordProps.length > 0 && <span className="flex items-center gap-1 text-blue-500">🏠 认证房东</span>}
                        </div>
                    </div>
                    <div className="flex gap-8 text-center border-l pl-8 border-gray-100">
                        <div>
                            <div className="text-xs text-gray-400 uppercase">RWA 净资产</div>
                            <div className="text-2xl font-bold text-gray-800">Ξ {data.totalAssetValue.toFixed(2)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-400 uppercase">预计月收</div>
                            <div className="text-2xl font-bold text-emerald-500">Ξ {data.totalMonthlyIncome.toFixed(3)}</div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
                    <div className="border-b px-6 flex gap-6">
                        {['assets', 'investments', 'rentals'].map(tab => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-4 text-sm font-bold border-b-2 transition-all ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                            >
                                {tab === 'assets' && `房东资产 (${data.landlordProps.length})`}
                                {tab === 'investments' && `投资组合 (${data.investments.length})`}
                                {tab === 'rentals' && `租赁记录 (${data.rentals.length})`}
                            </button>
                        ))}
                    </div>
                    
                    <div className="p-6">
                        {/* 列表渲染逻辑 */}
                        {((activeTab === 'assets' && data.landlordProps) || (activeTab === 'investments' && data.investments) || (activeTab === 'rentals' && data.rentals)).length === 0 ? (
                            <div className="text-center py-20 text-gray-400">暂无数据</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {((activeTab === 'assets' && data.landlordProps) || (activeTab === 'investments' && data.investments) || (activeTab === 'rentals' && data.rentals)).map((p, idx) => (
                                    <div key={idx} className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition bg-gray-50/50">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-gray-800">#{p.id} {p.name}</span>
                                            <span className={`text-[10px] px-2 rounded ${STATUS_BADGE_COLOR[p.status]}`}>{STATUS_MAP[p.status]}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 space-y-1">
                                            <p>📍 {p.physicalAddress}</p>
                                            {activeTab === 'investments' && <p className="text-indigo-600 font-bold">持有份额: {p.userShares}%</p>}
                                            {activeTab === 'rentals' && <p className="text-teal-600 font-bold">租期至: {new Date(p.rentEndTime*1000).toLocaleDateString()}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            {/* 顶部搜索条 */}
            <div className="bg-gray-900 rounded-2xl p-8 text-center relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <h2 className="text-3xl font-bold text-white mb-2 relative z-10">RWA Blockchain Explorer</h2>
                <p className="text-gray-400 mb-6 text-sm relative z-10">查询房产历史、追踪资金流向、分析用户资产</p>
                
                <div className="max-w-2xl mx-auto flex gap-2 relative z-10">
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="输入 Token ID (如 102) 或 钱包地址 (0x...)" 
                        className="flex-1 px-5 py-4 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button 
                        onClick={handleSearch}
                        disabled={loading}
                        className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : '🔎'}
                        查询
                    </button>
                </div>
            </div>

            {/* 内容区域切换 */}
            {loading ? (
                <div className="text-center py-20">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500">正在检索区块链数据...</p>
                </div>
            ) : viewMode === 'home' ? (
                <div className="animate-fade-in">
                    {/* 平台数据看板 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl">🏙️</div>
                            <div><div className="text-gray-400 text-xs uppercase">平台总市值</div><div className="text-2xl font-bold text-gray-800">Ξ {stats.tvl.toFixed(2)}</div></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-2xl">💵</div>
                            <div><div className="text-gray-400 text-xs uppercase">累计租金池</div><div className="text-2xl font-bold text-gray-800">Ξ {stats.totalRent.toFixed(2)}</div></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-2xl">👥</div>
                            <div><div className="text-gray-400 text-xs uppercase">活跃用户</div><div className="text-2xl font-bold text-gray-800">{stats.userCount}</div></div>
                        </div>
                    </div>

                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">🔥 热门融资项目 <span className="text-xs font-normal text-gray-400">实时数据</span></h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {properties.filter(p => p.status === 1).slice(0, 3).map(p => (
                            <div key={p.id} onClick={() => {setSearchResult({type:'property', data:p}); setViewMode('property');}} className="cursor-pointer bg-white rounded-xl p-5 border border-gray-100 hover:shadow-lg transition group">
                                <div className="flex justify-between mb-2">
                                    <span className="font-bold text-gray-800">#{p.id} {p.name}</span>
                                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded">融资中</span>
                                </div>
                                <div className="w-full bg-gray-100 h-1.5 rounded-full mb-2 overflow-hidden">
                                    <div className="bg-indigo-500 h-full rounded-full" style={{width: `${p.totalSharesSold ? p.totalSharesSold.toNumber() : 0}%`}}></div>
                                </div>
                                <div className="text-xs text-gray-400 group-hover:text-indigo-500 transition-colors">点击查看详情 →</div>
                            </div>
                        ))}
                        {properties.filter(p => p.status === 1).length === 0 && <div className="col-span-3 text-center text-gray-400 py-10 bg-gray-50 rounded-xl">暂无热门融资项目</div>}
                    </div>
                </div>
            ) : viewMode === 'property' && searchResult ? (
                <PropertyDetailView data={searchResult.data} />
            ) : viewMode === 'user' && searchResult ? (
                <UserProfileView data={searchResult.data} />
            ) : null}
        </div>
    );
};

window.Explorer = Explorer;