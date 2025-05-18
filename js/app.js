/**
 * 电视直播网站核心功能
 */

// 全局变量
let player = null;
let allChannels = [];
let categories = [];
let currentChannel = null;
let currentCategory = null;
let retryCount = 0;
const MAX_RETRIES = 3;

// 新增：用户数据相关变量
let favorites = [];
let playHistory = [];
let searchResults = [];

// DOM元素
const domElements = {
  playerWrapper: null,
  channelTitle: null,
  categoryTabs: null,
  channelsList: null,
  errorMessage: null,
  loadingOverlay: null,
  fullscreenBtn: null,
  retryBtn: null,
  sourceBtn: null,
  // 新增：搜索和功能按钮
  searchInput: null,
  searchBtn: null,
  favoriteBtn: null,
  historyBtn: null
};

// 初始化函数
document.addEventListener('DOMContentLoaded', () => {
  // 初始化DOM元素引用
  initDomElements();
  
  // 初始化Video.js播放器
  initPlayer();
  
  // 加载用户数据
  loadUserData();
  
  // 加载频道数据
  loadChannelData();

  // 绑定按钮事件
  bindEvents();
  bindAdditionalEvents();
});

// 初始化DOM元素引用
function initDomElements() {
  domElements.playerWrapper = document.getElementById('player-wrapper');
  domElements.channelTitle = document.getElementById('channel-title');
  domElements.categoryTabs = document.getElementById('category-tabs');
  domElements.channelsList = document.getElementById('channels-list');
  domElements.errorMessage = document.getElementById('error-message');
  domElements.loadingOverlay = document.getElementById('loading-overlay');
  domElements.fullscreenBtn = document.getElementById('fullscreen-btn');
  domElements.retryBtn = document.getElementById('retry-btn');
  domElements.sourceBtn = document.getElementById('source-btn');
  
  // 新增：初始化搜索和功能按钮
  domElements.searchInput = document.getElementById('search-input');
  domElements.searchBtn = document.getElementById('search-btn');
  domElements.favoriteBtn = document.getElementById('favorite-btn');
  domElements.historyBtn = document.getElementById('history-btn');
}

// 初始化Video.js播放器
function initPlayer() {
  const playerOptions = {
    autoplay: false,
    fluid: true,
    aspectRatio: '16:9',
    preload: 'metadata', // 改为metadata以加快加载
    controls: true,
    controlBar: {
      children: [
        'playToggle',
        'volumePanel',
        'currentTimeDisplay',
        'progressControl',
        'fullscreenToggle'
      ]
    },
    html5: {
      hls: {
        overrideNative: !videojs.browser.IS_IOS, // iOS使用原生HLS
        enableLowInitialPlaylist: true,
        limitRenditionByPlayerDimensions: true,
        smoothQualityChange: true
      },
      nativeAudioTracks: videojs.browser.IS_IOS,
      nativeVideoTracks: videojs.browser.IS_IOS
    },
    sources: [] // 初始为空
  };

  player = videojs('player', playerOptions);
  
  // 添加错误处理
  player.on('error', handlePlayerError);
  
  // 优化加载状态处理
  player.on('loadstart', () => showLoading('正在加载...'));
  player.on('loadedmetadata', () => hideLoading());
  player.on('playing', () => {
    hideLoading();
    hideError();
  });
  
  // 添加自动重连机制
  player.on('waiting', () => {
    const waitingTimeout = setTimeout(() => {
      if (player.readyState() < 3) {
        retryPlayback();
      }
    }, 10000); // 10秒后如果还在等待则重试
    
    player.one('playing', () => clearTimeout(waitingTimeout));
  });
}

// 加载频道数据
async function loadChannelData() {
  showLoading('加载频道列表...');
  
  try {
    // 加载内联的channels数据
    const response = await fetch('./data/channels.json');
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    const data = await response.json();
    
    if (!data || !data.categories) {
      throw new Error('频道数据格式无效');
    }
    
    categories = data.categories;
    processChannelData();
    hideLoading();
    
  } catch (error) {
    console.error('加载频道数据错误:', error);
    // 如果加载失败，尝试使用备用数据源
    try {
      const response = await fetch('https://raw.githubusercontent.com/你的用户名/你的仓库名/main/data/channels.json');
      if (!response.ok) {
        throw new Error('备用数据源也无法访问');
      }
      const data = await response.json();
      categories = data.categories;
      processChannelData();
      hideLoading();
    } catch (backupError) {
      hideLoading();
      showError(`加载频道失败，请检查网络连接后重试。${error.message}`);
    }
  }
}

// 处理频道数据
function processChannelData() {
  if (!categories || categories.length === 0) {
    showError('没有可用的频道分类');
    return;
  }

  // 提取所有频道
  allChannels = categories.reduce((acc, category) => {
    if (category.channels && Array.isArray(category.channels)) {
      return acc.concat(category.channels);
    }
    return acc;
  }, []);

  // 检查和过滤无效的频道
  allChannels = allChannels.filter(channel => {
    const isValid = channel && channel.name && 
                   Array.isArray(channel.sources) && 
                   channel.sources.length > 0;
    if (!isValid) {
      console.warn('发现无效的频道数据:', channel);
    }
    return isValid;
  });

  // 检查是否有可用频道
  if (allChannels.length === 0) {
    showError('没有可用的频道');
    return;
  }

  // 渲染界面
  renderCategoryTabs();
  if (categories.length > 0) {
    selectCategory(categories[0].name);
  }
}

// 渲染分类标签
function renderCategoryTabs() {
  domElements.categoryTabs.innerHTML = '';
  
  categories.forEach(category => {
    const tab = document.createElement('div');
    tab.className = 'category-tab';
    tab.textContent = category.name;
    tab.addEventListener('click', () => selectCategory(category.name));
    domElements.categoryTabs.appendChild(tab);
  });
}

// 选择分类
function selectCategory(categoryName) {
  currentCategory = categoryName;
  
  // 更新分类标签激活状态
  const tabs = domElements.categoryTabs.querySelectorAll('.category-tab');
  tabs.forEach(tab => {
    if (tab.textContent === categoryName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // 过滤当前分类的频道
  const categoryChannels = categories.find(c => c.name === categoryName)?.channels || [];
  
  // 渲染频道列表
  renderChannelsList(categoryChannels);
}

// 渲染频道列表
function renderChannelsList(channels) {
  domElements.channelsList.innerHTML = '';
  
  channels.forEach(channel => {
    const card = document.createElement('div');
    card.className = 'channel-card';
    if (currentChannel && channel.name === currentChannel.name) {
      card.classList.add('active');
    }
    
    const logo = document.createElement('img');
    logo.className = 'channel-logo';
    logo.src = channel.logo;
    logo.alt = channel.name;
    logo.onerror = () => {
      logo.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📺</text></svg>';
    };
    
    const info = document.createElement('div');
    info.className = 'channel-info';
    
    const name = document.createElement('div');
    name.className = 'channel-name';
    name.textContent = channel.name;
    
    const sources = document.createElement('div');
    sources.className = 'channel-sources';
    sources.textContent = `${channel.sources.length} 个直播源`;
    
    info.appendChild(name);
    info.appendChild(sources);
    
    card.appendChild(logo);
    card.appendChild(info);
    
    // 添加点击事件
    card.addEventListener('click', () => {
      playChannel(channel);
      // 添加激活状态
      document.querySelectorAll('.channel-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
    
    domElements.channelsList.appendChild(card);
  });
}

// 播放频道
function playChannel(channel) {
  showLoading('加载直播源...');
  currentChannel = channel;
  retryCount = 0;
  
  // 更新频道标题
  domElements.channelTitle.textContent = channel.name;
  
  // 新增：添加到历史记录
  addToHistory(channel);
  
  // 新增：更新收藏按钮状态
  updateFavoriteButton();
  
  // 更新频道列表中的激活状态
  const cards = domElements.channelsList.querySelectorAll('.channel-card');
  cards.forEach(card => {
    if (card.dataset.channelName === channel.name) {
      card.classList.add('active');
      // 滚动到可见区域
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      card.classList.remove('active');
    }
  });
  
  // 选择合适的直播源
  selectBestSource(channel);
}

// 选择最佳直播源
function selectBestSource(channel) {
  if (!channel.sources || channel.sources.length === 0) {
    hideLoading();
    showError('此频道没有可用的直播源');
    return;
  }
  
  // 检测设备和浏览器类型
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  // 根据设备选择最佳协议
  let bestSource = null;
  
  // 优先选择HLS (在iOS和Safari上最佳)
  if (isIOS || isSafari) {
    bestSource = channel.sources.find(source => source.type.toLowerCase() === 'hls');
  }
  
  // 如果是移动设备且没有HLS，则尝试DASH
  if (!bestSource && isMobile) {
    bestSource = channel.sources.find(source => source.type.toLowerCase() === 'dash');
  }
  
  // 如果还没有找到合适的源，则尝试HLS (大多数设备都支持)
  if (!bestSource) {
    bestSource = channel.sources.find(source => source.type.toLowerCase() === 'hls');
  }
  
  // 依次尝试其他格式
  if (!bestSource) {
    bestSource = channel.sources.find(source => source.type.toLowerCase() === 'dash');
  }
  
  if (!bestSource) {
    bestSource = channel.sources.find(source => source.type.toLowerCase() === 'flv');
  }
  
  // 如果还是没有找到，则使用第一个源
  if (!bestSource && channel.sources.length > 0) {
    bestSource = channel.sources[0];
  }
  
  // 播放选择的源
  playSource(bestSource);
}

// 优化的播放源选择逻辑
function playSource(source) {
  if (!source) {
    hideLoading();
    showError('没有可用的直播源');
    return;
  }
  
  const type = source.type.toLowerCase();
  const url = source.url;
  
  try {
    if (type === 'hls') {
      if (videojs.browser.IS_IOS) {
        // iOS设备使用原生HLS播放
        player.src({
          src: url,
          type: 'application/x-mpegURL'
        });
      } else if (Hls.isSupported()) {
        // 其他设备使用HLS.js
        const hls = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 3,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 3
        });
        
        hls.loadSource(url);
        hls.attachMedia(player.tech({ IWillNotUseThisInPlugins: true }).el());
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          player.play().catch(() => {
            // 自动播放失败，显示播放按钮
            player.bigPlayButton.show();
          });
        });
        
        // 错误处理
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('重新尝试加载直播源...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('重新尝试解码...');
                hls.recoverMediaError();
                break;
              default:
                retryPlayback();
                break;
            }
          }
        });
      }
    } else if (type === 'flv' && flvjs && flvjs.isSupported()) {
      const flvPlayer = flvjs.createPlayer({
        type: 'flv',
        url: url,
        isLive: true,
        hasAudio: true,
        hasVideo: true,
        enableStashBuffer: false
      });
      
      flvPlayer.attachMediaElement(player.tech({ IWillNotUseThisInPlugins: true }).el());
      flvPlayer.load();
      player.play();
    } else {
      // 降级使用普通播放器
      player.src({
        src: url,
        type: type === 'hls' ? 'application/x-mpegURL' : 'video/mp4'
      });
    }
    
    hideError();
  } catch (error) {
    console.error('播放器错误:', error);
    retryPlayback();
  }
}

// 切换到下一个源
function switchToNextSource() {
  if (!currentChannel || !currentChannel.sources || currentChannel.sources.length <= 1) {
    showError('没有其他可用的直播源');
    return;
  }
  
  let currentSourceIndex = -1;
  
  // 查找当前正在播放的源的索引
  const currentSrc = player.currentSrc();
  currentChannel.sources.forEach((source, index) => {
    if (source.url === currentSrc) {
      currentSourceIndex = index;
    }
  });
  
  // 选择下一个源
  const nextIndex = (currentSourceIndex + 1) % currentChannel.sources.length;
  const nextSource = currentChannel.sources[nextIndex];
  
  showLoading('切换直播源...');
  playSource(nextSource);
}

// 处理播放器错误
function handlePlayerError(error) {
  console.error('播放器错误:', error);
  
  // 如果重试次数未超过最大值，尝试切换源或重新加载
  if (retryCount < MAX_RETRIES) {
    retryCount++;
    
    if (currentChannel && currentChannel.sources && currentChannel.sources.length > 1) {
      // 如果有多个源，切换到下一个
      switchToNextSource();
    } else {
      // 否则重新加载当前源
      const currentSrc = player.currentSrc();
      const currentType = player.currentType();
      
      setTimeout(() => {
        showLoading('重新连接...');
        player.src({ src: currentSrc, type: currentType });
        player.play();
        hideLoading();
      }, 1000);
    }
  } else {
    hideLoading();
    showError('播放失败，请检查网络连接或点击重试按钮');
  }
}

// 重试播放
function retryPlayback() {
  if (retryCount < MAX_RETRIES) {
    retryCount++;
    showLoading(`加载失败，正在重试 (${retryCount}/${MAX_RETRIES})...`);
    setTimeout(() => {
      if (currentChannel) {
        playChannel(currentChannel);
      }
    }, 2000);
  } else {
    hideLoading();
    showError('播放失败，请切换其他直播源或检查网络连接');
  }
}

// 绑定按钮事件
function bindEvents() {
  // 全屏按钮
  if (domElements.fullscreenBtn) {
    domElements.fullscreenBtn.addEventListener('click', () => {
      if (player.isFullscreen()) {
        player.exitFullscreen();
      } else {
        player.requestFullscreen();
      }
    });
  }
  
  // 重试按钮
  if (domElements.retryBtn) {
    domElements.retryBtn.addEventListener('click', () => {
      if (currentChannel) {
        retryCount = 0;
        playChannel(currentChannel);
      }
    });
  }
  
  // 切换源按钮
  if (domElements.sourceBtn) {
    domElements.sourceBtn.addEventListener('click', switchToNextSource);
  }
}

// 新增：绑定搜索和功能按钮事件
function bindAdditionalEvents() {
  if (domElements.searchInput && domElements.searchBtn) {
    domElements.searchInput.addEventListener('input', (e) => {
      searchChannels(e.target.value);
    });
    
    domElements.searchBtn.addEventListener('click', () => {
      searchChannels(domElements.searchInput.value);
    });
  }
  
  if (domElements.favoriteBtn) {
    domElements.favoriteBtn.addEventListener('click', () => {
      if (currentChannel) {
        toggleFavorite(currentChannel);
      }
    });
  }
  
  if (domElements.historyBtn) {
    domElements.historyBtn.addEventListener('click', () => {
      renderChannelsList(playHistory);
    });
  }
}

// 显示加载中
function showLoading(message = '加载中...') {
  if (domElements.loadingOverlay) {
    domElements.loadingOverlay.textContent = message;
    domElements.loadingOverlay.style.display = 'flex';
  }
}

// 隐藏加载中
function hideLoading() {
  if (domElements.loadingOverlay) {
    domElements.loadingOverlay.style.display = 'none';
  }
}

// 显示错误信息
function showError(message) {
  if (domElements.errorMessage) {
    domElements.errorMessage.textContent = message;
    domElements.errorMessage.style.display = 'block';
    
    // 添加重试按钮
    const retryButton = document.createElement('button');
    retryButton.className = 'btn btn-secondary';
    retryButton.textContent = '重新加载';
    retryButton.style.marginLeft = '10px';
    retryButton.onclick = () => {
      domElements.errorMessage.style.display = 'none';
      loadChannelData();
    };
    
    domElements.errorMessage.appendChild(retryButton);
  }
}

// 隐藏错误信息
function hideError() {
  if (domElements.errorMessage) {
    domElements.errorMessage.style.display = 'none';
  }
}

// 新增：加载用户数据
function loadUserData() {
  favorites = JSON.parse(localStorage.getItem('tv_favorites') || '[]');
  playHistory = JSON.parse(localStorage.getItem('tv_history') || '[]');
}

// 新增：保存用户数据
function saveUserData() {
  localStorage.setItem('tv_favorites', JSON.stringify(favorites));
  localStorage.setItem('tv_history', JSON.stringify(playHistory));
}

// 新增：搜索频道
function searchChannels(keyword) {
  if (!keyword.trim()) {
    searchResults = [];
    renderChannelsList(allChannels);
    return;
  }
  
  keyword = keyword.toLowerCase();
  searchResults = allChannels.filter(channel => 
    channel.name.toLowerCase().includes(keyword)
  );
  
  renderChannelsList(searchResults);
}

// 新增：切换收藏状态
function toggleFavorite(channel) {
  const index = favorites.findIndex(f => f.name === channel.name);
  if (index === -1) {
    favorites.push(channel);
  } else {
    favorites.splice(index, 1);
  }
  saveUserData();
  updateFavoriteButton();
}

// 新增：更新收藏按钮状态
function updateFavoriteButton() {
  if (!currentChannel || !domElements.favoriteBtn) return;
  
  const isFavorite = favorites.some(f => f.name === currentChannel.name);
  domElements.favoriteBtn.classList.toggle('active', isFavorite);
  domElements.favoriteBtn.title = isFavorite ? '取消收藏' : '添加收藏';
}

// 新增：添加播放历史
function addToHistory(channel) {
  const index = playHistory.findIndex(h => h.name === channel.name);
  if (index !== -1) {
    playHistory.splice(index, 1);
  }
  playHistory.unshift(channel);
  if (playHistory.length > 20) {
    playHistory.pop();
  }
  saveUserData();
}