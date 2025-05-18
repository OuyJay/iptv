// Global variables
let player;
let currentChannel = null;
let currentSource = null;
let channels = [];
let categories = [];
let isPlaybackInitiated = false; // 跟踪播放是否已经开始
let playerInitAttempts = 0; // 播放器初始化尝试次数
const MAX_INIT_ATTEMPTS = 3; // 最大初始化尝试次数
let autoRetryTimeout = null; // 自动重试定时器

// 直播源备用URL列表 - 可替换为实际的备用源
const FALLBACK_SOURCES = {
    'cctv1': [
        { name: '备用高清', hls: 'https://cctvwbndks.v.kcdnvip.com/cctvwbnd/cctv1_2/index.m3u8' },
        { name: '备用标清', hls: 'http://39.134.115.163:8080/PLTV/88888910/224/3221225618/index.m3u8' }
    ],
    'cctv13': [
        { name: '备用高清', hls: 'https://cctvwbndks.v.kcdnvip.com/cctvwbnd/cctv13_2/index.m3u8' }
    ]
};

// Device detection - 优化设备检测逻辑
const deviceInfo = {
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
    isAndroid: /Android/.test(navigator.userAgent),
    isOldBrowser: !('fetch' in window) || !('Promise' in window),
    isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
    canPlayHLS: false,
    canPlayFLV: false,
    canPlayDASH: false,
    bandwidth: 'high' // 默认带宽设置
};

// 检测浏览器的媒体能力
function detectMediaCapabilities() {
    try {
        // 检测HLS支持
        deviceInfo.canPlayHLS = deviceInfo.isIOS || 
                               (document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== '');
        
        // 检测FLV支持 - 大多数浏览器需要插件
        deviceInfo.canPlayFLV = !deviceInfo.isMobile && window.flvjs && flvjs.isSupported();
        
        // 检测DASH支持
        deviceInfo.canPlayDASH = !deviceInfo.isOldBrowser && window.dashjs;
        
        // 带宽检测 - 简单估计
        if (navigator.connection) {
            const conn = navigator.connection;
            if (conn.saveData) {
                deviceInfo.bandwidth = 'low';
            } else if (conn.type === 'cellular' || conn.effectiveType === 'slow-2g' || 
                      conn.effectiveType === '2g' || conn.effectiveType === '3g') {
                deviceInfo.bandwidth = 'medium';
            }
        }
        
        console.log('媒体能力检测结果:', deviceInfo);
    } catch (error) {
        console.warn('媒体能力检测失败:', error);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

function init() {
    // 检测媒体能力
    detectMediaCapabilities();
    
    // Show loading screen
    document.getElementById('loadingContainer').style.display = 'flex';
    document.getElementById('mainContainer').style.display = 'none';
    
    console.log('初始化应用...');
    
    // Load channel data with timeout
    const dataLoadTimeout = setTimeout(() => {
        document.querySelector('.loading-text').textContent = '数据加载超时，请检查网络并刷新页面';
    }, 15000); // 15秒超时
    
    // Load channel data
    loadChannelData()
        .then(data => {
            clearTimeout(dataLoadTimeout);
            console.log('频道数据加载成功:', data);
            
            // 预缓存频道logo
            precacheImages();
            
            // Initialize video player
            initializePlayer();
            
            // Setup UI elements
            setupChannelSelector();
            setupSourceSelector();
            setupQualitySelector();
            setupCategoryTabs();
            
            // Hide loading screen after setup
            setTimeout(() => {
                document.getElementById('loadingContainer').style.display = 'none';
                document.getElementById('mainContainer').style.display = 'block';
            }, 1000);
        })
        .catch(error => {
            clearTimeout(dataLoadTimeout);
            console.error('Error initializing app:', error);
            document.querySelector('.loading-text').textContent = '加载出错，请刷新页面重试：' + error.message;
            
            // 尝试加载本地备份数据
            loadLocalBackupData();
        });
}

// 预缓存图片以提高加载速度
function precacheImages() {
    if (!channels || channels.length === 0) return;
    
    try {
        channels.forEach(channel => {
            if (channel.logo) {
                const img = new Image();
                img.src = channel.logo;
            }
        });
    } catch (error) {
        console.warn('预缓存图片失败:', error);
    }
}

// 尝试加载本地备份数据
function loadLocalBackupData() {
    try {
        console.log('尝试加载本地备份数据...');
        // 创建最小可用的频道数据
        channels = [
            {
                name: "CCTV-1 综合",
                categoryId: "cctv",
                sources: [
                    {
                        name: "备用线路",
                        hls: "https://cctvwbndks.v.kcdnvip.com/cctvwbnd/cctv1_2/index.m3u8"
                    }
                ]
            }
        ];
        
        categories = [
            {
                id: "cctv",
                name: "央视频道"
            }
        ];
        
        // 继续初始化应用
        initializePlayer();
        setupChannelSelector();
        setupSourceSelector();
        setupQualitySelector();
        setupCategoryTabs();
        
        // 显示主界面
        setTimeout(() => {
            document.getElementById('loadingContainer').style.display = 'none';
            document.getElementById('mainContainer').style.display = 'block';
            // 显示警告
            alert('使用备份数据加载，功能可能受限。请检查网络后刷新页面。');
        }, 1000);
    } catch (error) {
        console.error('加载备份数据失败:', error);
        document.querySelector('.loading-text').textContent = '无法加载数据，请检查网络设置并刷新页面';
    }
}

// Load channel data from JSON file
async function loadChannelData() {
    try {
        console.log('开始加载频道数据...');
        
        // Use fetch for modern browsers, fallback for older browsers
        let response;
        if (deviceInfo.isOldBrowser) {
            // Fallback for older browsers using XMLHttpRequest
            response = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', 'data/channels.json');
                xhr.timeout = 10000; // 10秒超时
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const jsonData = JSON.parse(xhr.responseText);
                            resolve({ ok: true, json: () => jsonData });
                        } catch (e) {
                            reject(new Error('JSON解析失败: ' + e.message));
                        }
                    } else {
                        reject(new Error('HTTP错误: ' + xhr.status));
                    }
                };
                xhr.onerror = () => reject(new Error('网络错误'));
                xhr.ontimeout = () => reject(new Error('请求超时'));
                xhr.send();
            });
        } else {
            // Modern fetch API with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            try {
                console.log('使用fetch API加载数据...');
                response = await fetch('data/channels.json', { 
                    signal: controller.signal 
                });
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error('Failed to load channel data: ' + response.status);
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                throw fetchError;
            }
        }
        
        const data = await response.json();
        console.log('解析JSON数据成功');
        
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format');
        }
        
        channels = Array.isArray(data.channels) ? data.channels : [];
        categories = Array.isArray(data.categories) ? data.categories : [];
        
        // 保存通道数量信息用于初始化统计和补充缺失数据
        console.log(`加载了 ${channels.length} 个频道和 ${categories.length} 个分类`);
        
        // 验证必要的数据完整性
        validateAndFixChannelData();
        
        if (channels.length === 0) {
            console.warn('警告: 没有频道数据');
        }
        
        if (categories.length === 0) {
            console.warn('警告: 没有分类数据');
        }
        
        return data;
    } catch (error) {
        console.error('Error loading channel data:', error);
        throw error;
    }
}

// 验证和修复频道数据
function validateAndFixChannelData() {
    try {
        // 确保每个频道都有基本属性
        channels = channels.filter(channel => {
            // 验证频道必须有名称
            if (!channel || !channel.name) {
                console.warn('发现无效频道，将被过滤:', channel);
                return false;
            }
            
            // 确保有sources数组
            if (!channel.sources || !Array.isArray(channel.sources) || channel.sources.length === 0) {
                console.warn(`频道 ${channel.name} 没有信号源，尝试添加默认信号源`);
                
                // 根据频道名称匹配备用源
                const channelKey = Object.keys(FALLBACK_SOURCES).find(key => 
                    channel.name.toLowerCase().includes(key.toLowerCase()));
                
                if (channelKey && FALLBACK_SOURCES[channelKey]) {
                    channel.sources = FALLBACK_SOURCES[channelKey];
                    console.log(`已为 ${channel.name} 添加备用信号源`);
                } else {
                    // 如果没有匹配的备用源，则跳过此频道
                    return false;
                }
            }
            
            // 为每个信号源添加名称（如果没有）
            channel.sources.forEach((source, index) => {
                if (!source.name) {
                    source.name = `信号源 ${index + 1}`;
                }
            });
            
            return true;
        });
        
        // 确保每个分类都有ID和名称
        categories = categories.filter(category => 
            category && category.id && category.name);
    } catch (error) {
        console.error('验证和修复频道数据失败:', error);
    }
}

// Initialize video.js player with appropriate tech based on device
function initializePlayer() {
    try {
        console.log('初始化播放器...');
        playerInitAttempts++;
        
        // 如果已经超过最大尝试次数，提示并停止
        if (playerInitAttempts > MAX_INIT_ATTEMPTS) {
            throw new Error('多次初始化播放器失败，请刷新页面重试');
        }
        
        // Determine best technology based on device
        let techOrder = ['html5'];
        
        // 根据检测到的设备能力设置技术顺序
        if (deviceInfo.canPlayHLS && !deviceInfo.isIOS) {
            techOrder.unshift('hlsjs');
        }
        
        if (deviceInfo.canPlayFLV && !deviceInfo.isMobile) {
            techOrder.push('flvjs');
        }
        
        if (deviceInfo.canPlayDASH && !deviceInfo.isOldBrowser) {
            techOrder.push('dash');
        }
        
        console.log('使用技术栈顺序:', techOrder.join(', '));
        
        // Check if videoPlayer element exists
        const videoElement = document.getElementById('videoPlayer');
        if (!videoElement) {
            throw new Error('找不到视频播放器元素');
        }
        
        // 如果播放器已存在，先销毁
        if (player) {
            try {
                player.dispose();
                console.log('已销毁旧播放器实例');
            } catch (e) {
                console.warn('销毁旧播放器失败:', e);
            }
        }
        
        // Initialize Video.js player with optimized settings
        player = videojs('videoPlayer', {
            controls: true,
            autoplay: false,
            preload: 'auto',
            fluid: false, // 禁用fluid模式，避免布局计算
            responsive: true,
            playbackRates: [0.5, 1, 1.5, 2],
            techOrder: techOrder,
            html5: {
                hls: {
                    overrideNative: !deviceInfo.isIOS,
                    enableLowInitialPlaylist: deviceInfo.bandwidth !== 'high',
                    // 添加更多HLS优化选项
                    cacheEncryptionKeys: true,
                    captureEncryptionKey: true
                },
                nativeVideoTracks: deviceInfo.isIOS || deviceInfo.isMobile,
                nativeAudioTracks: deviceInfo.isIOS || deviceInfo.isMobile,
                nativeTextTracks: deviceInfo.isIOS || deviceInfo.isMobile
            },
            // 减少延迟的设置
            liveui: true,
            liveTracker: {
                trackingThreshold: 0.5,
                liveTolerance: 15
            }
        });
        
        // Optimize video buffer
        if (player.tech_ && player.tech_.hls) {
            player.tech_.hls.bandwidth = 5000000; // 5mbps默认带宽
            player.tech_.hls.bufferSize = 30; // 30秒缓冲区
            
            // 根据设备类型调整
            if (deviceInfo.bandwidth === 'low') {
                player.tech_.hls.bandwidth = 1000000; // 1mbps
                player.tech_.hls.bufferSize = 15; // 15秒缓冲区
            }
        }
        
        // Add event listeners
        player.on('error', handlePlayerError);
        
        // 添加额外事件监听
        player.on('waiting', () => {
            console.log('视频加载中...');
            showBufferingIndicator(true);
        });
        
        player.on('playing', () => {
            console.log('视频开始播放');
            isPlaybackInitiated = true;
            showBufferingIndicator(false);
        });
        
        console.log('播放器初始化成功');
    } catch (error) {
        console.error('播放器初始化失败:', error);
        document.querySelector('.loading-text').textContent = '播放器初始化失败: ' + error.message;
        
        // 延迟重试初始化
        setTimeout(() => {
            console.log(`重试初始化播放器 (尝试 ${playerInitAttempts + 1}/${MAX_INIT_ATTEMPTS})`);
            initializePlayer();
        }, 2000);
    }
}

// Setup channel dropdown
function setupChannelSelector() {
    try {
        console.log('设置频道选择器...');
        const channelSelect = document.getElementById('channelSelect');
        
        if (!channelSelect) {
            throw new Error('找不到频道选择器元素');
        }
        
        // Clear existing options
        channelSelect.innerHTML = '<option value="" disabled selected>选择频道</option>';
        
        // Add channels to selector
        channels.forEach((channel, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = channel.name;
            channelSelect.appendChild(option);
        });
        
        // Add change event listener
        channelSelect.addEventListener('change', function() {
            const selectedIndex = parseInt(this.value);
            if (!isNaN(selectedIndex) && channels[selectedIndex]) {
                selectChannel(selectedIndex);
            }
        });
        console.log('频道选择器设置完成');
    } catch (error) {
        console.error('设置频道选择器失败:', error);
    }
}

// Setup source dropdown
function setupSourceSelector() {
    try {
        console.log('设置信号源选择器...');
        const sourceSelect = document.getElementById('sourceSelect');
        
        if (!sourceSelect) {
            throw new Error('找不到信号源选择器元素');
        }
        
        // Add change event listener
        sourceSelect.addEventListener('change', function() {
            const selectedIndex = parseInt(this.value);
            if (!isNaN(selectedIndex) && currentChannel) {
                selectSource(selectedIndex);
            }
        });
        console.log('信号源选择器设置完成');
    } catch (error) {
        console.error('设置信号源选择器失败:', error);
    }
}

// Setup quality dropdown
function setupQualitySelector() {
    try {
        console.log('设置画质选择器...');
        const qualitySelect = document.getElementById('qualitySelect');
        
        if (!qualitySelect) {
            throw new Error('找不到画质选择器元素');
        }
        
        // Add change event listener
        qualitySelect.addEventListener('change', function() {
            const quality = this.value;
            setVideoQuality(quality);
        });
        console.log('画质选择器设置完成');
    } catch (error) {
        console.error('设置画质选择器失败:', error);
    }
}

// Setup category tabs
function setupCategoryTabs() {
    try {
        console.log('设置分类标签...');
        const categoryTabsContainer = document.getElementById('categoryTabs');
        const channelsGridContainer = document.getElementById('channelsGrid');
        
        if (!categoryTabsContainer || !channelsGridContainer) {
            throw new Error('找不到分类标签容器或频道网格容器');
        }
        
        // Clear existing tabs
        categoryTabsContainer.innerHTML = '';
        
        // Add "All" category
        const allTab = document.createElement('div');
        allTab.className = 'category-tab active';
        allTab.textContent = '全部';
        allTab.dataset.category = 'all';
        categoryTabsContainer.appendChild(allTab);
        
        console.log(`添加分类标签: 全部 (类别ID: all)`);
        
        // Add category tabs
        if (categories && categories.length > 0) {
            categories.forEach(category => {
                if (!category || !category.id || !category.name) {
                    console.warn('跳过无效的分类:', category);
                    return;
                }
                
                const tab = document.createElement('div');
                tab.className = 'category-tab';
                tab.textContent = category.name;
                tab.dataset.category = category.id;
                categoryTabsContainer.appendChild(tab);
                
                console.log(`添加分类标签: ${category.name} (类别ID: ${category.id})`);
            });
        } else {
            console.warn('没有分类数据可显示');
        }
        
        // Add click event listeners to tabs
        const tabs = categoryTabsContainer.querySelectorAll('.category-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                console.log(`点击分类: ${this.textContent} (类别ID: ${this.dataset.category})`);
                
                // Remove active class from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                // Add active class to clicked tab
                this.classList.add('active');
                
                // Filter channels by category
                const categoryId = this.dataset.category;
                displayChannelsByCategory(categoryId);
            });
        });
        
        // Initially display all channels
        displayChannelsByCategory('all');
        console.log('分类标签设置完成');
    } catch (error) {
        console.error('设置分类标签失败:', error);
    }
}

// Display channels filtered by category
function displayChannelsByCategory(categoryId) {
    try {
        console.log(`显示类别 [${categoryId}] 的频道`);
        const channelsGridContainer = document.getElementById('channelsGrid');
        
        if (!channelsGridContainer) {
            throw new Error('找不到频道网格容器');
        }
        
        // Clear existing channels
        channelsGridContainer.innerHTML = '';
        
        if (!channels || channels.length === 0) {
            console.warn('没有频道数据可显示');
            const noChannelsMsg = document.createElement('div');
            noChannelsMsg.className = 'no-channels-message';
            noChannelsMsg.textContent = '没有可用的频道';
            noChannelsMsg.style.textAlign = 'center';
            noChannelsMsg.style.padding = '20px';
            noChannelsMsg.style.gridColumn = '1 / -1';
            channelsGridContainer.appendChild(noChannelsMsg);
            return;
        }
        
        // Filter channels by category
        const filteredChannels = categoryId === 'all' 
            ? channels 
            : channels.filter(channel => channel.categoryId === categoryId);
        
        console.log(`过滤后的频道数量: ${filteredChannels.length}`);
        
        if (filteredChannels.length === 0) {
            const noCategoryMsg = document.createElement('div');
            noCategoryMsg.className = 'no-channels-message';
            noCategoryMsg.textContent = '该分类下没有频道';
            noCategoryMsg.style.textAlign = 'center';
            noCategoryMsg.style.padding = '20px';
            noCategoryMsg.style.gridColumn = '1 / -1';
            channelsGridContainer.appendChild(noCategoryMsg);
            return;
        }
        
        // Add channel items to grid
        filteredChannels.forEach((channel, index) => {
            if (!channel || !channel.name) {
                console.warn('跳过无效的频道:', channel);
                return;
            }
            
            const channelItem = document.createElement('div');
            channelItem.className = 'channel-item';
            channelItem.dataset.index = channels.indexOf(channel);
            
            // Use logo if available, otherwise use placeholder
            let logoHtml;
            if (channel.logo) {
                logoHtml = `<img src="${channel.logo}" alt="${channel.name}" class="channel-logo" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'50\\' height=\\'50\\' viewBox=\\'0 0 50 50\\'><rect width=\\'50\\' height=\\'50\\' fill=\\'%23555\\'/><text x=\\'50%\\' y=\\'50%\\' font-size=\\'24\\' text-anchor=\\'middle\\' fill=\\'white\\' dominant-baseline=\\'middle\\'>${channel.name.charAt(0)}</text></svg>';">`;
            } else {
                logoHtml = `<div class="channel-logo-placeholder" style="width:50px;height:50px;background:#555;border-radius:4px;color:white;display:flex;align-items:center;justify-content:center;font-size:24px;">${channel.name.charAt(0)}</div>`;
            }
            
            channelItem.innerHTML = `
                ${logoHtml}
                <div class="channel-name">${channel.name}</div>
            `;
            
            // Add click event listener
            channelItem.addEventListener('click', function() {
                const channelIndex = parseInt(this.dataset.index);
                if (!isNaN(channelIndex) && channels[channelIndex]) {
                    console.log(`选择频道: ${channels[channelIndex].name} (索引: ${channelIndex})`);
                    selectChannel(channelIndex);
                    
                    // Update active state
                    const items = channelsGridContainer.querySelectorAll('.channel-item');
                    items.forEach(item => item.classList.remove('active'));
                    this.classList.add('active');
                }
            });
            
            channelsGridContainer.appendChild(channelItem);
        });
    } catch (error) {
        console.error('显示频道分类失败:', error);
    }
}

// Select a channel
function selectChannel(index) {
    try {
        if (!channels[index]) {
            throw new Error(`无效的频道索引: ${index}`);
        }
        
        currentChannel = channels[index];
        console.log(`选择频道: ${currentChannel.name}`);
        
        // Update channel selector
        const channelSelect = document.getElementById('channelSelect');
        if (channelSelect) {
            channelSelect.value = index;
        }
        
        // Update source selector
        if (currentChannel.sources && currentChannel.sources.length > 0) {
            updateSourceSelector(currentChannel.sources);
            
            // Select first source by default
            selectSource(0);
        } else {
            console.warn(`频道 ${currentChannel.name} 没有可用的信号源`);
            if (player) {
                player.pause();
                player.src('');
                
                // Show error message
                const errorOverlay = document.createElement('div');
                errorOverlay.className = 'error-overlay';
                errorOverlay.textContent = '该频道没有可用的信号源';
                errorOverlay.style.position = 'absolute';
                errorOverlay.style.top = '0';
                errorOverlay.style.left = '0';
                errorOverlay.style.width = '100%';
                errorOverlay.style.height = '100%';
                errorOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                errorOverlay.style.color = 'white';
                errorOverlay.style.display = 'flex';
                errorOverlay.style.justifyContent = 'center';
                errorOverlay.style.alignItems = 'center';
                errorOverlay.style.zIndex = '100';
                
                const playerContainer = document.querySelector('.player-container');
                if (playerContainer) {
                    playerContainer.appendChild(errorOverlay);
                    
                    // Remove error message after 5 seconds
                    setTimeout(() => {
                        try {
                            playerContainer.removeChild(errorOverlay);
                        } catch (e) {
                            console.warn('无法移除错误覆盖层:', e);
                        }
                    }, 5000);
                }
            }
        }
        
        // Highlight active channel in grid
        const channelItems = document.querySelectorAll('.channel-item');
        channelItems.forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.index) === index);
        });
    } catch (error) {
        console.error('选择频道失败:', error);
    }
}

// Update source dropdown based on selected channel
function updateSourceSelector(sources) {
    try {
        console.log(`更新信号源选择器, ${sources.length} 个可用信号源`);
        const sourceSelect = document.getElementById('sourceSelect');
        
        if (!sourceSelect) {
            throw new Error('找不到信号源选择器元素');
        }
        
        // Clear existing options
        sourceSelect.innerHTML = '<option value="" disabled selected>选择信号源</option>';
        
        // Add sources to selector
        if (sources && sources.length > 0) {
            sources.forEach((source, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = source.name || `信号源 ${index + 1}`;
                sourceSelect.appendChild(option);
            });
        } else {
            console.warn('没有可用的信号源');
            
            const option = document.createElement('option');
            option.value = "";
            option.disabled = true;
            option.selected = true;
            option.textContent = "没有可用的信号源";
            sourceSelect.appendChild(option);
        }
    } catch (error) {
        console.error('更新信号源选择器失败:', error);
    }
}

// Select a source and play video
function selectSource(index) {
    try {
        if (!currentChannel || !currentChannel.sources || index >= currentChannel.sources.length) {
            throw new Error(`无效的信号源索引: ${index}`);
        }
        
        currentSource = currentChannel.sources[index];
        console.log(`选择信号源: ${currentSource.name || '未命名'} (索引: ${index})`);
        
        const sourceSelect = document.getElementById('sourceSelect');
        if (sourceSelect) {
            sourceSelect.value = index;
        }
        
        // 重置播放状态
        isPlaybackInitiated = false;
        
        // Determine the best URL based on device
        const url = getBestStreamUrl(currentSource);
        
        if (!url) {
            throw new Error('找不到可用的播放地址');
        }
        
        console.log(`播放URL: ${url}`);
        
        // 添加加载提示
        showBufferingIndicator(true);
        
        // Stop current video if playing
        if (player) {
            player.pause();
            // 不要立即清除源，避免闪烁
            setTimeout(() => {
                // 设置新源并播放
                setPlayerSource(url);
            }, 300);
        } else {
            console.warn('播放器未初始化，尝试重新初始化');
            initializePlayer();
            
            // 延迟设置源
            setTimeout(() => {
                if (player) {
                    setPlayerSource(url);
                }
            }, 1000);
        }
    } catch (error) {
        console.error('选择信号源失败:', error);
        
        // Show error message
        if (player) {
            handlePlayerError(error);
        } else {
            // 如果播放器不存在，显示错误消息
            alert('播放器错误: ' + error.message);
        }
    }
}

// Determine best stream URL based on device capabilities
function getBestStreamUrl(source) {
    try {
        if (!source) {
            throw new Error('无效的信号源');
        }
        
        // Parse source URLs
        const urls = {
            hls: source.hls || null,
            flv: source.flv || null,
            dash: source.dash || null,
            mp4: source.mp4 || null
        };
        
        // 过滤出所有可用URL，以便日志显示
        const availableFormats = Object.entries(urls)
            .filter(([_, url]) => url)
            .map(([format, _]) => format);
        
        console.log('可用的流媒体格式:', availableFormats.join(', ') || '无');
        
        // Check if there are any valid URLs
        const hasValidUrl = Object.values(urls).some(url => url);
        if (!hasValidUrl) {
            throw new Error('没有可用的播放地址');
        }
        
        // Choose best format based on device
        let selectedUrl;
        let selectedFormat;
        
        // 首先根据设备带宽优化选择
        if (deviceInfo.bandwidth === 'low') {
            // 低带宽设备优先使用较低码率格式
            selectedUrl = urls.mp4 || urls.hls || urls.dash || urls.flv;
            selectedFormat = urls.mp4 ? 'MP4' : 
                            urls.hls ? 'HLS' : 
                            urls.dash ? 'DASH' : 'FLV';
        } else {
            // 根据设备类型选择最佳协议
            if (deviceInfo.isIOS && urls.hls) {
                // iOS has native HLS support
                selectedUrl = urls.hls;
                selectedFormat = 'HLS';
            } else if (deviceInfo.isAndroid) {
                // Android prefers HLS or MP4
                selectedUrl = urls.hls || urls.mp4 || urls.dash || urls.flv;
                selectedFormat = urls.hls ? 'HLS' : 
                                urls.mp4 ? 'MP4' : 
                                urls.dash ? 'DASH' : 'FLV';
            } else if (deviceInfo.isOldBrowser) {
                // Old browsers prefer MP4 if available
                selectedUrl = urls.mp4 || urls.hls || urls.flv;
                selectedFormat = urls.mp4 ? 'MP4' : 
                                urls.hls ? 'HLS' : 'FLV';
            } else {
                // Desktop browsers can handle any format
                selectedUrl = urls.hls || urls.dash || urls.flv || urls.mp4;
                selectedFormat = urls.hls ? 'HLS' : 
                                urls.dash ? 'DASH' : 
                                urls.flv ? 'FLV' : 'MP4';
            }
        }
        
        console.log(`已为 ${deviceInfo.isMobile ? '移动' : '桌面'} 设备选择 ${selectedFormat} 格式`);
        
        // 检查URL是否有效
        if (!selectedUrl || typeof selectedUrl !== 'string' || !selectedUrl.startsWith('http')) {
            console.warn('所选URL可能无效:', selectedUrl);
            
            // 返回任何可用的URL作为后备
            for (const format in urls) {
                if (urls[format] && typeof urls[format] === 'string' && urls[format].startsWith('http')) {
                    console.log(`切换到备用格式: ${format}`);
                    return urls[format];
                }
            }
            
            throw new Error('没有有效的播放地址');
        }
        
        return selectedUrl;
    } catch (error) {
        console.error('获取最佳流媒体URL失败:', error);
        return null;
    }
}

// Set player source with appropriate type
function setPlayerSource(url) {
    try {
        if (!url) {
            throw new Error('无效的播放地址');
        }
        
        if (!player) {
            throw new Error('播放器未初始化');
        }
        
        // 清除之前的自动重试计时器
        if (autoRetryTimeout) {
            clearTimeout(autoRetryTimeout);
            autoRetryTimeout = null;
        }
        
        let type = '';
        
        // Determine source type from URL
        if (url.includes('.m3u8')) {
            type = 'application/x-mpegURL';
            console.log('设置HLS源');
        } else if (url.includes('.flv')) {
            type = 'video/x-flv';
            console.log('设置FLV源');
        } else if (url.includes('.mpd')) {
            type = 'application/dash+xml';
            console.log('设置DASH源');
        } else if (url.includes('.mp4')) {
            type = 'video/mp4';
            console.log('设置MP4源');
        } else {
            console.warn('未知的视频类型，尝试自动检测');
            // Try to guess based on common extensions
            if (url.includes('.ts')) {
                type = 'video/mp2t';
            } else if (url.includes('.webm')) {
                type = 'video/webm';
            } else {
                type = 'application/x-mpegURL'; // Default to HLS
            }
        }
        
        // 清除之前的错误
        const errorDisplay = player.getChild('errorDisplay');
        if (errorDisplay) {
            errorDisplay.hide();
        }
        
        // 显示加载指示器
        showBufferingIndicator(true);
        
        // 设置加载超时检测
        const loadTimeout = setTimeout(() => {
            console.warn('视频加载超时');
            if (!isPlaybackInitiated) {
                // 如果播放尚未开始，触发错误处理
                const timeoutError = new Error('加载超时');
                handlePlayerError(timeoutError);
            }
        }, 15000); // 15秒超时
        
        // Set source and play
        player.src({
            src: url,
            type: type
        });
        
        // Auto-play after source change
        const playPromise = player.play();
        
        // Handle auto-play restrictions
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('播放开始成功');
                    isPlaybackInitiated = true;
                    clearTimeout(loadTimeout);
                })
                .catch(error => {
                    clearTimeout(loadTimeout);
                    console.log('浏览器阻止了自动播放:', error);
                    
                    // 检查是否是有效的阻止自动播放错误
                    if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
                        // 显示手动播放按钮
                        const playButton = document.querySelector('.vjs-big-play-button');
                        if (playButton) {
                            playButton.style.display = 'block';
                        }
                        
                        // 隐藏缓冲提示
                        showBufferingIndicator(false);
                    } else {
                        // 其他错误可能是播放源问题
                        handlePlayerError(error);
                    }
                });
        }
    } catch (error) {
        console.error('设置播放源失败:', error);
        handlePlayerError(error);
    }
}

// Set video quality
function setVideoQuality(quality) {
    try {
        if (!player) {
            throw new Error('播放器未初始化');
        }
        
        if (!player.qualityLevels) {
            console.warn('播放器不支持画质调整功能');
            return;
        }
        
        console.log(`设置画质: ${quality}`);
        
        const qualityLevels = player.qualityLevels();
        
        if (qualityLevels.length === 0) {
            console.warn('没有可用的画质级别');
            return;
        }
        
        console.log(`可用画质级别数量: ${qualityLevels.length}`);
        
        // Enable/disable quality levels based on selection
        for (let i = 0; i < qualityLevels.length; i++) {
            if (quality === 'auto') {
                // Enable all for auto
                qualityLevels[i].enabled = true;
            } else if (quality === 'high' && i >= qualityLevels.length * 0.7) {
                // Enable top 30% for high
                qualityLevels[i].enabled = true;
            } else if (quality === 'medium' && i >= qualityLevels.length * 0.3 && i < qualityLevels.length * 0.7) {
                // Enable middle 40% for medium
                qualityLevels[i].enabled = true;
            } else if (quality === 'low' && i < qualityLevels.length * 0.3) {
                // Enable bottom 30% for low
                qualityLevels[i].enabled = true;
            } else {
                qualityLevels[i].enabled = false;
            }
        }
    } catch (error) {
        console.error('设置视频画质失败:', error);
    }
}

// Handle player errors
function handlePlayerError(error) {
    console.error('视频播放器错误:', error);
    
    // 隐藏缓冲指示器
    showBufferingIndicator(false);
    
    // 清除之前的自动重试计时器
    if (autoRetryTimeout) {
        clearTimeout(autoRetryTimeout);
    }
    
    let errorMessage = '播放出错，请尝试其他信号源';
    let didAutoSwitch = false;
    
    try {
        // 尝试确定具体错误类型
        let errorCode = '';
        if (error && error.code) {
            errorCode = error.code;
        } else if (player && player.error && player.error()) {
            errorCode = player.error().code;
        }
        
        // 根据错误类型自定义消息
        if (errorCode === 1) {
            errorMessage = '获取视频源失败，请稍后再试';
        } else if (errorCode === 2) {
            errorMessage = '网络错误，请检查网络连接';
        } else if (errorCode === 3) {
            errorMessage = '解码错误，该格式可能不受支持';
        } else if (errorCode === 4) {
            errorMessage = '视频源不可用，请尝试其他信号源';
        } else if (errorCode === 5) {
            errorMessage = '加载超时，请检查网络连接';
        }
        
        // Only try to switch source if we have a current channel with multiple sources
        if (currentChannel && currentChannel.sources && currentChannel.sources.length > 1) {
            const sourceSelect = document.getElementById('sourceSelect');
            const currentIndex = sourceSelect ? parseInt(sourceSelect.value) : -1;
            
            if (!isNaN(currentIndex) && currentIndex >= 0) {
                const nextIndex = (currentIndex + 1) % currentChannel.sources.length;
                
                console.log(`自动切换到下一个信号源: ${nextIndex}`);
                didAutoSwitch = true;
                
                // Try next source
                selectSource(nextIndex);
                
                errorMessage += '，已自动切换到下一个信号源';
            }
        }
        
        // 如果有FALLBACK_SOURCES备用源且未自动切换，尝试使用备用源
        if (!didAutoSwitch && currentChannel) {
            const channelKey = Object.keys(FALLBACK_SOURCES).find(key => 
                currentChannel.name.toLowerCase().includes(key.toLowerCase()));
            
            if (channelKey && FALLBACK_SOURCES[channelKey] && FALLBACK_SOURCES[channelKey].length > 0) {
                console.log(`尝试使用备用信号源`);
                
                // 创建临时源并播放
                const backupSource = FALLBACK_SOURCES[channelKey][0];
                currentSource = backupSource;
                
                const url = backupSource.hls || backupSource.mp4 || backupSource.dash || backupSource.flv;
                if (url) {
                    // 设置延迟，给UI时间显示错误
                    autoRetryTimeout = setTimeout(() => {
                        console.log('切换到备用源:', url);
                        setPlayerSource(url);
                        errorMessage += '，正在尝试备用线路...';
                        didAutoSwitch = true;
                    }, 3000);
                }
            }
        }
        
        // 如果没有自动切换，且播放尚未开始，尝试重新加载当前源
        if (!didAutoSwitch && !isPlaybackInitiated && currentSource) {
            autoRetryTimeout = setTimeout(() => {
                console.log('尝试重新加载当前源');
                const url = getBestStreamUrl(currentSource);
                if (url) {
                    setPlayerSource(url);
                }
            }, 5000);
            
            errorMessage += '，正在重试...';
        }
        
        // Show error message
        const errorOverlay = document.createElement('div');
        errorOverlay.className = 'error-overlay';
        errorOverlay.textContent = errorMessage;
        errorOverlay.style.position = 'absolute';
        errorOverlay.style.top = '0';
        errorOverlay.style.left = '0';
        errorOverlay.style.width = '100%';
        errorOverlay.style.height = '100%';
        errorOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        errorOverlay.style.color = 'white';
        errorOverlay.style.display = 'flex';
        errorOverlay.style.justifyContent = 'center';
        errorOverlay.style.alignItems = 'center';
        errorOverlay.style.zIndex = '100';
        
        const playerContainer = document.querySelector('.player-container');
        if (playerContainer) {
            playerContainer.appendChild(errorOverlay);
            
            // Remove error message after 5 seconds
            setTimeout(() => {
                try {
                    if (errorOverlay.parentNode) {
                        playerContainer.removeChild(errorOverlay);
                    }
                } catch (e) {
                    console.warn('无法移除错误覆盖层:', e);
                }
            }, 5000);
        } else {
            console.warn('找不到播放器容器，无法显示错误信息');
        }
    } catch (err) {
        console.error('处理播放器错误失败:', err);
    }
}

// 显示/隐藏缓冲指示器
function showBufferingIndicator(show) {
    try {
        let bufferingEl = document.querySelector('.buffering-indicator');
        
        if (show) {
            if (!bufferingEl) {
                bufferingEl = document.createElement('div');
                bufferingEl.className = 'buffering-indicator';
                bufferingEl.innerHTML = `
                    <div class="buffering-spinner"></div>
                    <div class="buffering-text">加载中...</div>
                `;
                bufferingEl.style.position = 'absolute';
                bufferingEl.style.top = '50%';
                bufferingEl.style.left = '50%';
                bufferingEl.style.transform = 'translate(-50%, -50%)';
                bufferingEl.style.background = 'rgba(0, 0, 0, 0.7)';
                bufferingEl.style.padding = '20px';
                bufferingEl.style.borderRadius = '5px';
                bufferingEl.style.zIndex = '100';
                
                const playerContainer = document.querySelector('.player-container');
                if (playerContainer) {
                    playerContainer.appendChild(bufferingEl);
                }
            }
        } else if (bufferingEl) {
            bufferingEl.parentNode.removeChild(bufferingEl);
        }
    } catch (error) {
        console.warn('处理缓冲指示器失败:', error);
    }
} 