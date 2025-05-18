// 初始化变量
let streams = [];
let currentStreamId = null;

// DOM元素
const addStreamForm = document.getElementById('add-stream-form');
const streamList = document.getElementById('stream-list');
const searchInput = document.getElementById('search-input');
const categorySelect = document.getElementById('category-select');
const importBtn = document.getElementById('import-btn');
const exportBtn = document.getElementById('export-btn');
const importFile = document.getElementById('import-file');
const playerModal = document.getElementById('player-modal');
const videoPlayer = document.getElementById('video-player');
const playingTitle = document.getElementById('playing-title');
const closeModal = document.querySelector('.close');

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 从localStorage加载直播源
    loadStreams();
    
    // 渲染直播源列表
    renderStreamList();
    
    // 添加事件监听器
    addEventListeners();
});

// 添加事件监听器
function addEventListeners() {
    // 添加直播源表单提交
    addStreamForm.addEventListener('submit', handleAddStream);
    
    // 搜索功能
    searchInput.addEventListener('input', filterStreams);
    
    // 分类筛选
    categorySelect.addEventListener('change', filterStreams);
    
    // 导入导出功能
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', handleImport);
    exportBtn.addEventListener('click', handleExport);
    
    // 关闭播放器模态框
    closeModal.addEventListener('click', closePlayerModal);
    window.addEventListener('click', (e) => {
        if (e.target === playerModal) {
            closePlayerModal();
        }
    });
}

// 从localStorage加载直播源
function loadStreams() {
    const savedStreams = localStorage.getItem('tv-streams');
    if (savedStreams) {
        streams = JSON.parse(savedStreams);
    } else {
        // 如果没有保存的直播源，添加一些示例直播源
        streams = [
            {
                id: generateId(),
                name: 'CCTV-1 综合',
                url: 'http://39.134.115.163:8080/PLTV/88888910/224/3221225618/index.m3u8',
                category: '央视',
                logo: 'https://upload.wikimedia.org/wikipedia/zh/6/65/CCTV-1_Logo.png'
            },
            {
                id: generateId(),
                name: 'CCTV-5 体育',
                url: 'http://39.134.115.163:8080/PLTV/88888910/224/3221225633/index.m3u8',
                category: '央视',
                logo: 'https://upload.wikimedia.org/wikipedia/zh/3/33/CCTV-5_Logo.png'
            },
            {
                id: generateId(),
                name: '湖南卫视',
                url: 'http://39.134.115.163:8080/PLTV/88888910/224/3221225704/index.m3u8',
                category: '卫视',
                logo: 'https://upload.wikimedia.org/wikipedia/zh/1/10/Hunan_TV.png'
            }
        ];
        saveStreams();
    }
}

// 保存直播源到localStorage
function saveStreams() {
    localStorage.setItem('tv-streams', JSON.stringify(streams));
}

// 渲染直播源列表
function renderStreamList(filteredStreams = null) {
    // 清空列表
    streamList.innerHTML = '';
    
    // 使用过滤后的列表或完整列表
    const streamsToRender = filteredStreams || streams;
    
    if (streamsToRender.length === 0) {
        streamList.innerHTML = '<p class="no-streams">没有找到直播源，请添加或导入直播源。</p>';
        return;
    }
    
    // 为每个直播源创建元素
    streamsToRender.forEach(stream => {
        const streamItem = document.createElement('div');
        streamItem.className = 'stream-item';
        streamItem.dataset.id = stream.id;
        
        // 默认logo
        const logoUrl = stream.logo || 'https://via.placeholder.com/60?text=TV';
        
        streamItem.innerHTML = `
            <img src="${logoUrl}" alt="${stream.name}" class="stream-logo" onerror="this.src='https://via.placeholder.com/60?text=TV'">
            <div class="stream-name">${stream.name}</div>
            <div class="stream-category">${stream.category}</div>
            <div class="stream-actions">
                <button class="btn play-btn">播放</button>
                <button class="btn btn-danger delete-btn">删除</button>
            </div>
        `;
        
        streamList.appendChild(streamItem);
        
        // 添加播放按钮事件
        streamItem.querySelector('.play-btn').addEventListener('click', () => {
            playStream(stream);
        });
        
        // 添加删除按钮事件
        streamItem.querySelector('.delete-btn').addEventListener('click', () => {
            deleteStream(stream.id);
        });
    });
}

// 处理添加直播源
function handleAddStream(e) {
    e.preventDefault();
    
    const nameInput = document.getElementById('stream-name');
    const urlInput = document.getElementById('stream-url');
    const categoryInput = document.getElementById('stream-category');
    const logoInput = document.getElementById('stream-logo');
    
    // 创建新的直播源对象
    const newStream = {
        id: generateId(),
        name: nameInput.value.trim(),
        url: urlInput.value.trim(),
        category: categoryInput.value,
        logo: logoInput.value.trim()
    };
    
    // 添加到数组
    streams.push(newStream);
    
    // 保存并重新渲染
    saveStreams();
    renderStreamList();
    
    // 重置表单
    addStreamForm.reset();
    
    // 显示成功消息
    alert(`成功添加直播源: ${newStream.name}`);
}

// 播放直播源
function playStream(stream) {
    currentStreamId = stream.id;
    playingTitle.textContent = `正在播放: ${stream.name}`;
    
    // 显示模态框
    playerModal.style.display = 'block';
    
    // 使用hls.js播放m3u8流
    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(stream.url);
        hls.attachMedia(videoPlayer);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            videoPlayer.play();
        });
        
        // 错误处理
        hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
                switch(data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        alert('网络错误，请检查直播源地址是否有效');
                        hls.destroy();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        alert('媒体错误，尝试恢复...');
                        hls.recoverMediaError();
                        break;
                    default:
                        alert('播放错误，请尝试其他直播源');
                        hls.destroy();
                        break;
                }
            }
        });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        // 对于Safari等原生支持HLS的浏览器
        videoPlayer.src = stream.url;
        videoPlayer.addEventListener('loadedmetadata', function() {
            videoPlayer.play();
        });
        
        videoPlayer.addEventListener('error', function() {
            alert('播放错误，请检查直播源地址是否有效');
        });
    } else {
        alert('您的浏览器不支持播放HLS流，请尝试使用Chrome、Firefox或Safari');
    }
}

// 关闭播放器模态框
function closePlayerModal() {
    playerModal.style.display = 'none';
    videoPlayer.pause();
    videoPlayer.src = '';
    currentStreamId = null;
}

// 删除直播源
function deleteStream(id) {
    if (confirm('确定要删除这个直播源吗？')) {
        streams = streams.filter(stream => stream.id !== id);
        saveStreams();
        renderStreamList();
    }
}

// 筛选直播源
function filterStreams() {
    const searchTerm = searchInput.value.toLowerCase();
    const categoryFilter = categorySelect.value;
    
    let filtered = streams;
    
    // 按搜索词筛选
    if (searchTerm) {
        filtered = filtered.filter(stream => 
            stream.name.toLowerCase().includes(searchTerm)
        );
    }
    
    // 按分类筛选
    if (categoryFilter !== 'all') {
        filtered = filtered.filter(stream => 
            stream.category === categoryFilter
        );
    }
    
    renderStreamList(filtered);
}

// 处理导入
function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedStreams = JSON.parse(e.target.result);
            
            // 验证导入的数据格式
            if (Array.isArray(importedStreams) && importedStreams.every(isValidStream)) {
                if (confirm(`确定要导入${importedStreams.length}个直播源吗？这将覆盖现有的直播源。`)) {
                    streams = importedStreams;
                    saveStreams();
                    renderStreamList();
                    alert('导入成功！');
                }
            } else {
                alert('导入失败：无效的数据格式');
            }
        } catch (error) {
            alert('导入失败：' + error.message);
        }
        
        // 重置文件输入
        e.target.value = '';
    };
    
    reader.readAsText(file);
}

// 处理导出
function handleExport() {
    if (streams.length === 0) {
        alert('没有直播源可导出');
        return;
    }
    
    const dataStr = JSON.stringify(streams, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileName = `tv-streams-${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
}

// 验证导入的直播源格式
function isValidStream(stream) {
    return (
        typeof stream === 'object' &&
        stream !== null &&
        typeof stream.name === 'string' &&
        typeof stream.url === 'string' &&
        typeof stream.category === 'string'
    );
}

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}