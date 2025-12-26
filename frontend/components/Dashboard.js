// ... (前置代码 StyledInput, MiniInput, CopyAddress 保持不变)
const CopyAddress = ({ address, label }) => {
    if (!address) return <span>-</span>;
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const copy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(address);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '地址已复制', showConfirmButton: false, timer: 1000 });
    };
    return (
        <div onClick={copy} className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 px-1.5 py-0.5 rounded transition-colors group">
            <span className="text-xs text-gray-500 font-mono group-hover:text-indigo-600">{label || short}</span>
            <svg className="w-3 h-3 text-gray-400 group-hover:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </div>
    );
};
const StyledInput = ({ label, value, onChange, placeholder, type="text", fullWidth=false }) => (
    <div className={`${fullWidth ? 'col-span-1 md:col-span-2' : 'col-span-1'}`}>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5 ml-1">{label}</label>
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} min={type === "number" ? "0" : undefined} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all duration-200" />
    </div>
);
const MiniInput = ({ placeholder, value, onChange }) => (
    <input className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/10 transition-all placeholder-gray-400" placeholder={placeholder} value={value} onChange={onChange} />
);

const PROPERTY_TYPES = [
    { value: '公寓', label: '🏢 公寓 (Apartment)' },
    { value: '小区住宅', label: '🏠 小区住宅 (Residential)' },
    { value: '独栋别墅', label: '🏡 独栋别墅 (Villa)' },
    { value: '海景房', label: '🌊 海景房 (Seaview)' },
    { value: '大平层', label: '🏙️ 城市大平层 (Flat)' },
    { value: '商业办公', label: '💼 商业办公 (Office)' },
    { value: 'other', label: '✏️ 其他 (自定义)' }
];

// ⚠️ 注意：这里增加了 onBurn 参数
const Dashboard = ({ account, properties, myDeposit, myWithdrawable, onList, onStartInvest, onUpdateInfo, onLock, onListRent, onWithdrawDeposit, onWithdraw, onBurn, loadingMap }) => {
    const [listForm, setListForm] = React.useState({ name: "", address: "", area: "", type: "公寓", phone: "" });
    const [forms, setForms] = React.useState({});
    const [assetTab, setAssetTab] = React.useState('landlord');
    const [selectedType, setSelectedType] = React.useState('公寓');

    const config = window.AppConfig || { STATUS_MAP: [], STATUS_BADGE_COLOR: [] };
    const { STATUS_MAP } = config;
    const { Button } = window.UI || { Button: 'button' };

    const myProps = properties.filter(p => p.landlord.toLowerCase() === account.toLowerCase());
    const myInvestments = properties.filter(p => p.myShares > 0 && p.landlord.toLowerCase() !== account.toLowerCase());
    const myRentals = properties.filter(p => p.tenant.toLowerCase() === account.toLowerCase());

    const handleForm = (id, field, value) => setForms(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

    const handleTypeSelect = (e) => {
        const val = e.target.value;
        setSelectedType(val);
        if (val !== 'other') { setListForm(prev => ({ ...prev, type: val })); } else { setListForm(prev => ({ ...prev, type: '' })); }
    };

    const handleMint = async () => {
        if(!listForm.name || !listForm.address || !listForm.area || !listForm.type || !listForm.phone) { await Swal.fire('信息不全', '请完整填写所有房产信息', 'error'); return; }
        const areaNum = parseFloat(listForm.area);
        if (isNaN(areaNum) || areaNum <= 0) { await Swal.fire('数值错误', '房产面积必须是一个大于 0 的有效数字', 'error'); setListForm(prev => ({ ...prev, area: "" })); return; }
        const result = await Swal.fire({ title: '确定要上链吗？', text: "上链操作将铸造 NFT，且数据不可篡改", icon: 'warning', showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#ef4444', confirmButtonText: '🚀 确定上链' });
        if (!result.isConfirmed) return;
        const success = await onList(listForm);
        if (success) { setListForm({ name: "", address: "", area: "", type: "公寓", phone: "" }); setSelectedType("公寓"); }
    };

    const handleWithdrawClick = () => {
        const amount = window.prompt(`当前合约内可提余额: ${myWithdrawable} ETH\n\n请输入要提取的金额:`);
        if (amount) onWithdraw(amount);
    };

    // ✅ [修改] 开启融资确认：包含 RightsDuration 和 FundraisingDays
    const handleStartInvestConfirm = async (id) => {
        const f = forms[id] || {};
        // 校验输入
        if (!f.price) return Swal.fire('提示', '请填写房产月估值', 'info');
        
        // 弹出复杂表单询问两个时间参数
        const { value: formValues } = await Swal.fire({
            title: '📡 开启融资配置',
            html: `
                <div class="text-left space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">1. 投资者权益周期 (月)</label>
                        <p class="text-xs text-gray-400 mb-1">投资者购买的是未来几个月的收益权？(1-12个月)</p>
                        <input id="swal-rights" type="number" class="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="例如: 12" min="1" max="12">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">2. 融资窗口期 (天)</label>
                        <p class="text-xs text-gray-400 mb-1">允许投资者购买的时间窗口 (7-14天)</p>
                        <input id="swal-days" type="number" class="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="例如: 7" min="7" max="14">
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '下一步: 计算押金',
            preConfirm: () => {
                const rights = document.getElementById('swal-rights').value;
                const days = document.getElementById('swal-days').value;
                if (!rights || rights < 1 || rights > 12) Swal.showValidationMessage('权益周期必须是 1-12 个月');
                if (!days || days < 7 || days > 14) Swal.showValidationMessage('融资窗口必须是 7-14 天');
                return [rights, days];
            }
        });

        if (!formValues) return;
        const [rightsDuration, fundraisingDays] = formValues;

        // 计算逻辑
        const monthlyVal = parseFloat(f.price);
        // 这里为了演示，押金仍按权益周期总价值的 30% 计算 (您可以根据需要调整)
        const totalValue = monthlyVal * rightsDuration;
        const deposit = totalValue * 0.30;
        const sharePrice = totalValue / 100;

        const result = await Swal.fire({
            title: '💰 支付确认',
            html: `
                <div class="text-left text-sm space-y-3 p-2">
                    <div class="flex justify-between border-b pb-1"><span class="text-gray-500">月估值:</span><span class="font-bold text-gray-800">${monthlyVal} ETH</span></div>
                    <div class="flex justify-between border-b pb-1"><span class="text-gray-500">权益周期:</span><span class="font-bold">${rightsDuration} 个月</span></div>
                    <div class="flex justify-between border-b pb-1"><span class="text-gray-500">融资窗口:</span><span class="font-bold text-orange-600">${fundraisingDays} 天</span></div>
                    
                    <div class="flex justify-between border-b pb-1 bg-gray-50 p-1 rounded"><span class="text-gray-600">总估值:</span><span class="font-bold text-gray-900">${totalValue.toFixed(4)} ETH</span></div>
                    <div class="flex justify-between border-b pb-1 text-xs text-gray-500 mt-2"><span>单份价格 (1%):</span><span class="font-mono font-bold text-indigo-500">${sharePrice.toFixed(4)} ETH</span></div>
                    
                    <div class="flex justify-between items-center pt-2 mt-2 border-t border-dashed"><span class="text-gray-600 font-medium">需缴纳押金 (30%):</span><span class="text-xl font-bold text-indigo-600">${deposit.toFixed(4)} ETH</span></div>
                </div>
            `,
            icon: 'info', showCancelButton: true, confirmButtonText: '确认并支付', confirmButtonColor: '#4f46e5'
        });
        
        if (result.isConfirmed) {
            // 调用 App.js 的 onStartInvest
            onStartInvest(id, sharePrice.toString(), rightsDuration, fundraisingDays, deposit.toString());
        }
    };

    // ✅ [新增] 修改房产信息 UI
    const handleUpdateInfoClick = async (p) => {
        const { value: formValues } = await Swal.fire({
            title: `📝 修改房产信息 #${p.id}`,
            html: `
                <input id="swal-name" class="swal2-input" placeholder="名称" value="${p.name}">
                <input id="swal-addr" class="swal2-input" placeholder="地址" value="${p.physicalAddress}">
                <input id="swal-area" class="swal2-input" placeholder="面积" type="number" value="${p.area}">
                <input id="swal-type" class="swal2-input" placeholder="类型" value="${p.propertyType}">
                <input id="swal-phone" class="swal2-input" placeholder="电话" value="${p.landlordPhone}">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '保存修改',
            preConfirm: () => {
                return {
                    name: document.getElementById('swal-name').value,
                    address: document.getElementById('swal-addr').value,
                    area: document.getElementById('swal-area').value,
                    type: document.getElementById('swal-type').value,
                    phone: document.getElementById('swal-phone').value
                }
            }
        });

        if (formValues) {
            onUpdateInfo(p.id, formValues);
        }
    };

    const handleBurnClick = async (id, name) => {
        const result = await Swal.fire({
            title: '⚠️ 确定要销毁吗？',
            html: `您正在试图销毁房产 <b>${name}</b>。<br/><br/>此操作将永久删除链上数据，且<b>不可恢复</b>！`,
            icon: 'error', showCancelButton: true, confirmButtonText: '🗑️ 确认销毁', confirmButtonColor: '#dc2626', cancelButtonText: '取消', reverseButtons: true, background: '#fff0f0'
        });
        if (result.isConfirmed) onBurn(id);
    };

    const getStatusStyle = (status) => {
        switch(status) {
            case 0: return { bar: 'bg-slate-300', badge: 'bg-slate-100 text-slate-600 border-slate-200' };
            case 1: return { bar: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
            case 2: return { bar: 'bg-purple-500', badge: 'bg-purple-50 text-purple-600 border-purple-100' };
            case 3: return { bar: 'bg-orange-400', badge: 'bg-orange-50 text-orange-600 border-orange-100' };
            case 4: return { bar: 'bg-teal-500', badge: 'bg-teal-50 text-teal-600 border-teal-100' };
            default: return { bar: 'bg-gray-200', badge: 'bg-gray-100 text-gray-500' };
        }
    };

    const renderDynamicInfo = (p) => {
        if (p.status === 1) {
            const sold = p.totalSharesSold && p.totalSharesSold.toNumber ? p.totalSharesSold.toNumber() : 0;
            const myHoldings = p.myShares; const price = parseFloat(ethers.utils.formatEther(p.sharePrice)); const myValue = myHoldings * price; 
            return (
                <div className="bg-indigo-50/50 rounded-xl p-3 mb-4 border border-indigo-100">
                    <div className="flex justify-between items-end mb-1"><span className="text-[10px] font-bold text-indigo-600 uppercase">融资进度</span><span className="text-xs font-bold text-indigo-700">{sold}%</span></div>
                    <div className="w-full bg-indigo-200 rounded-full h-1.5 mb-3 overflow-hidden"><div className="bg-indigo-600 h-1.5 rounded-full" style={{width: `${sold}%`}}></div></div>
                    {/* 显示融资截止时间 */}
                    <div className="text-[10px] text-gray-400 text-center mb-2">截止: {new Date(p.investmentEndTime * 1000).toLocaleString()}</div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-white rounded p-1.5 shadow-sm"><div className="text-[10px] text-gray-400">当前单价</div><div className="text-xs font-bold text-gray-800">{price} <span className="text-[9px] font-normal">ETH</span></div></div>
                        <div className="bg-white rounded p-1.5 shadow-sm"><div className="text-[10px] text-gray-400">我仍持有</div><div className="text-xs font-bold text-indigo-600">{myHoldings} <span className="text-[9px] font-normal">份</span></div></div>
                    </div>
                </div>
            );
        }
        if (p.status === 4) {
            const rent = parseFloat(ethers.utils.formatEther(p.monthlyRent)); const mySharePercent = p.myShares; const myIncome = rent * (mySharePercent / 100);
            return (
                <div className="bg-teal-50/50 rounded-xl p-3 mb-4 border border-teal-100">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-teal-100/50"><div className="flex items-center gap-1"><span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-bold">租客</span><CopyAddress address={p.tenant} label={p.tenant.slice(0,6)+'...'} /></div><div className="text-[10px] text-gray-400">租期生效中</div></div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                         <div className="bg-white rounded p-1.5 shadow-sm"><div className="text-[10px] text-gray-400">每月租金</div><div className="text-xs font-bold text-teal-600">{rent} ETH</div></div>
                         <div className="bg-white rounded p-1.5 shadow-sm"><div className="text-[10px] text-gray-400">我的权益</div><div className="text-xs font-bold text-teal-600">{mySharePercent}%</div></div>
                        <div className="col-span-2 bg-teal-100/50 rounded p-1.5 flex justify-between items-center px-3"><span className="text-[10px] text-teal-800">预计月收入 (自动到账)</span><span className="text-xs font-bold text-teal-700">+{myIncome.toFixed(4)} ETH</span></div>
                    </div>
                </div>
            );
        }
        return (
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px] text-gray-500 mb-4 bg-slate-50/80 p-2.5 rounded-lg border border-gray-100/50">
                <div className="truncate flex items-center gap-1.5" title={p.physicalAddress}><span className="opacity-50">📍</span>{p.physicalAddress}</div>
                <div className="truncate flex items-center gap-1.5"><span className="opacity-50">🏗️</span>{p.propertyType}</div>
                <div className="truncate flex items-center gap-1.5"><span className="opacity-50">📞</span>{p.landlordPhone}</div>
                <div className="truncate flex items-center gap-1.5"><span className="opacity-50">📏</span>{p.area} ㎡</div>
                <div className="col-span-2 flex items-center gap-1.5 border-t border-gray-200 pt-1.5 mt-0.5"><span className="opacity-50">👤</span> <span className="scale-90 origin-left"><CopyAddress address={p.landlord} label={p.landlord.slice(0,10) + "..."} /></span></div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* 上半部分：发布与概览 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2">✨ 发布新房产 <span className="text-xs font-normal text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">Mint NFT</span></h3></div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="lg:col-span-2"><StyledInput label="🏠 名称" placeholder="如: 海景房" value={listForm.name} onChange={e=>setListForm({...listForm, name:e.target.value})} /></div>
                            <div className="lg:col-span-2"><StyledInput label="📍 地址" placeholder="真实地址" value={listForm.address} onChange={e=>setListForm({...listForm, address:e.target.value})} /></div>
                            <div className="lg:col-span-1"><StyledInput label="📐 面积(㎡)" placeholder="0" type="number" value={listForm.area} onChange={e=>setListForm({...listForm, area:e.target.value})} /></div>
                            <div className="lg:col-span-2"><label className="block text-sm font-semibold text-gray-600 mb-1.5 ml-1">🏗️ 类型</label><div className={`flex gap-2`}><select value={selectedType} onChange={handleTypeSelect} className={`px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all ${selectedType === 'other' ? 'w-1/3' : 'w-full'}`}>{PROPERTY_TYPES.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}</select>{selectedType === 'other' && (<input type="text" placeholder="请输入自定义类型" value={listForm.type} onChange={e=>setListForm({...listForm, type:e.target.value})} className="w-2/3 px-4 py-2.5 bg-white border border-indigo-300 rounded-xl text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 animate-fade-in" autoFocus />)}</div></div>
                            <div className="lg:col-span-2"><StyledInput label="📱 电话" placeholder="联系方式" value={listForm.phone} onChange={e=>setListForm({...listForm, phone:e.target.value})} /></div>
                            <div className="lg:col-span-1 flex items-end"><Button loading={loadingMap['list']} onClick={handleMint} className="w-full h-[46px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-100">🚀 上链</Button></div>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-4 space-y-4">
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 shadow-lg text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">🔒</div>
                        <div className="mb-4 border-b border-gray-700 pb-4"><h4 className="text-gray-400 text-xs font-medium mb-1">合约冻结押金 (Locked)</h4><div className="text-2xl font-bold tracking-tight">{myDeposit} <span className="text-sm font-normal opacity-60">ETH</span></div></div>
                        <div><div className="flex justify-between items-end mb-2"><h4 className="text-emerald-400 text-xs font-medium">可提取余额 (Available)</h4></div><div className="flex items-center justify-between"><div className="text-2xl font-bold text-emerald-400">{myWithdrawable} <span className="text-sm font-normal opacity-60 text-emerald-200">ETH</span></div><button onClick={handleWithdrawClick} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95">提现</button></div></div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between"><div><p className="text-gray-500 text-xs font-medium">总管理资产</p><p className="text-xl font-bold text-gray-800">{myProps.length} <span className="text-xs font-normal text-gray-400">套</span></p></div><div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-xl">🔑</div></div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[650px]">
                <div className="border-b border-gray-100 px-6 py-3 bg-white sticky top-0 z-10 flex justify-between items-center">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setAssetTab('landlord')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${assetTab === 'landlord' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>👨‍✈️ 房东 ({myProps.length})</button>
                        <button onClick={() => setAssetTab('investor')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${assetTab === 'investor' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>🚀 投资者 ({myInvestments.length})</button>
                        <button onClick={() => setAssetTab('tenant')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${assetTab === 'tenant' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>🔑 租客 ({myRentals.length})</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50">
                    {assetTab === 'landlord' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {myProps.map(p => {
                                const styles = getStatusStyle(p.status);
                                return (
                                    <div key={p.id} className="bg-white rounded-xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:border-indigo-300 transition-all duration-300 overflow-hidden flex flex-col group">
                                        <div className={`h-1.5 w-full ${styles.bar}`}></div>
                                        <div className="p-4 flex-1 flex flex-col">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h4 className="font-bold text-gray-800 text-sm truncate w-36" title={p.name}>{p.name}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${styles.badge}`}>{STATUS_MAP[p.status]}</span>
                                                        <CopyAddress address={p.id} label={`#${p.id}`} />
                                                    </div>
                                                </div>
                                            </div>

                                            {renderDynamicInfo(p)}

                                            <div className="mt-auto space-y-2">
                                                {/* 状态 0: 闲置 -> 开启融资 + 销毁按钮 + 修改信息按钮 */}
                                                {p.status === 0 && <div className="flex flex-col gap-2 bg-white rounded-lg">
                                                    <div className="flex-1"><MiniInput placeholder="月估值 (ETH)" value={(forms[p.id] && forms[p.id].price) || ''} onChange={e=>handleForm(p.id,'price',e.target.value)} /></div>
                                                    <div className="flex gap-2">
                                                        {/* 修改信息 */}
                                                        <Button onClick={() => handleUpdateInfoClick(p)} className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-500 border border-blue-200 rounded-lg text-xs" title="修改信息">✏️</Button>
                                                        {/* 销毁 */}
                                                        <Button onClick={() => handleBurnClick(p.id, p.name)} className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 rounded-lg text-xs" title="销毁房产">🗑️</Button>
                                                        {/* 开启融资 */}
                                                        <Button className="flex-1 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm" loading={loadingMap[p.id]} onClick={()=>handleStartInvestConfirm(p.id)}>📡 开启融资</Button>
                                                    </div>
                                                </div>}

                                                {p.status === 1 && <Button className="w-full py-2 text-xs bg-orange-400 hover:bg-orange-500 text-white rounded-lg shadow-sm border-none" loading={loadingMap[p.id]} onClick={()=>onLock(p.id)}>🔒 锁定并结束融资</Button>}
                                                {p.status === 2 && <div className="flex gap-2 items-center bg-white p-0.5 rounded-lg">
                                                    <div className="flex-1"><MiniInput placeholder="月租金(ETH)" value={(forms[p.id] && forms[p.id].rent) || ''} onChange={e=>handleForm(p.id,'rent',e.target.value)} /></div>
                                                    <Button className="py-2 px-4 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm border-none" loading={loadingMap[p.id]} onClick={()=>onListRent(p.id, forms[p.id])}>上架招租</Button>
                                                </div>}
                                                {p.status === 3 && <div className="text-center py-2 bg-orange-50 text-orange-600 text-xs rounded font-medium border border-orange-100">⏳ 等待租客入住...</div>}
                                                {p.status === 4 && <div className="flex gap-2">
                                                    <div className="flex-1 text-center py-1.5 text-[10px] text-green-600 bg-green-50 rounded border border-green-200">💰 租金自动分账</div>
                                                    <Button variant="outline" className="flex-1 py-1.5 text-[10px] border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300" loading={loadingMap[p.id]} onClick={()=>onWithdrawDeposit(p.id)}>退押金</Button>
                                                </div>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {/* ... (Investor/Tenant views 保持不变) ... */}
                    {(assetTab === 'investor' || assetTab === 'tenant') && (
                         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {(assetTab === 'investor' ? myInvestments : myRentals).map(p => (
                                <div key={p.id} className={`bg-white rounded-xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] border border-gray-100 transition-all duration-300 overflow-hidden relative group hover:border-${assetTab==='investor'?'pink':'teal'}-300`}>
                                    <div className={`h-1.5 w-full bg-${assetTab==='investor'?'pink':'teal'}-500`}></div>
                                    <div className={`absolute top-4 right-4 bg-${assetTab==='investor'?'pink':'teal'}-50 text-${assetTab==='investor'?'pink':'teal'}-600 text-[10px] font-bold px-2 py-0.5 rounded border border-${assetTab==='investor'?'pink':'teal'}-100`}>{assetTab==='investor' ? `持有 ${p.myShares}%` : '我正在租'}</div>
                                    <div className="p-5">
                                        <h4 className="font-bold text-gray-800 text-sm mb-1">{p.name}</h4>
                                        <p className="text-[10px] text-gray-400 mb-4 flex gap-2"><span>{p.propertyType}</span> • <span>{p.area}㎡</span></p>
                                        {assetTab === 'investor' ? (
                                             <div className="bg-green-50 rounded-lg p-3 border border-green-100 text-center"><p className="text-green-700 text-xs font-bold">🎉 收益自动分账</p><p className="text-[10px] text-green-500 mt-1">余额已更新至右上角</p></div>
                                        ) : (
                                            <div className="bg-teal-50/50 rounded-lg p-3 mb-4 border border-teal-100"><div className="flex justify-between text-[11px] mb-1.5"><span className="text-gray-500">房东</span><CopyAddress address={p.landlord} /></div><div className="flex justify-between text-[11px] mb-1.5"><span className="text-gray-500">月租金</span><span className="font-bold text-teal-600">{ethers.utils.formatEther(p.monthlyRent)} ETH</span></div><Button className="w-full mt-2 py-2 text-xs bg-white border border-red-200 text-red-500 hover:bg-red-50 font-semibold" loading={loadingMap[p.id]} onClick={()=>onWithdrawDeposit(p.id)}>👋 退房 / 退回押金</Button></div>
                                        )}
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
window.Dashboard = Dashboard;