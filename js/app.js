// Global variables
let player;
let currentChannel = null;
let currentSource = null;
let channels = [];
let categories = [];

// Device detection
const deviceInfo = {
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
    isAndroid: /Android/.test(navigator.userAgent),
    isOldBrowser: !('fetch' in window) || !('Promise' in window)
};

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Show loading screen
    document.getElementById('loadingContainer').style.display = 'flex';
    document.getElementById('mainContainer').style.display = 'none';
    
    // Load channel data
    loadChannelData()
        .then(() => {
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
            console.error('Error initializing app:', error);
            document.querySelector('.loading-text').textContent = '加载出错，请刷新页面重试';
        });
}

// Load channel data from JSON file
async function loadChannelData() {
    try {
        // Use fetch for modern browsers, fallback for older browsers
        let response;
        if (deviceInfo.isOldBrowser) {
            // Fallback for older browsers using XMLHttpRequest
            response = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', 'data/channels.json');
                xhr.onload = () => resolve({ ok: true, json: () => JSON.parse(xhr.responseText) });
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send();
            });
        } else {
            // Modern fetch API
            response = await fetch('data/channels.json');
            if (!response.ok) {
                throw new Error('Failed to load channel data');
            }
        }
        
        const data = await response.json();
        channels = data.channels || [];
        categories = data.categories || [];
        
        return true;
    } catch (error) {
        console.error('Error loading channel data:', error);
        throw error;
    }
}

// Initialize video.js player with appropriate tech based on device
function initializePlayer() {
    // Determine best technology based on device
    let techOrder = ['html5'];
    
    // Add HLS.js tech for non-iOS browsers that need it
    if (!deviceInfo.isIOS) {
        techOrder.unshift('hlsjs');
    }
    
    // Add FLV.js for desktop browsers
    if (!deviceInfo.isMobile) {
        techOrder.push('flvjs');
    }
    
    // Add Dash for modern browsers
    if (!deviceInfo.isOldBrowser) {
        techOrder.push('dash');
    }
    
    // Initialize Video.js player
    player = videojs('videoPlayer', {
        controls: true,
        autoplay: false,
        preload: 'auto',
        fluid: true,
        playbackRates: [0.5, 1, 1.5, 2],
        techOrder: techOrder,
        html5: {
            hls: {
                overrideNative: !deviceInfo.isIOS,
                enableLowInitialPlaylist: true
            }
        }
    });
    
    // Add event listeners
    player.on('error', handlePlayerError);
}

// Setup channel dropdown
function setupChannelSelector() {
    const channelSelect = document.getElementById('channelSelect');
    
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
}

// Setup source dropdown
function setupSourceSelector() {
    const sourceSelect = document.getElementById('sourceSelect');
    
    // Add change event listener
    sourceSelect.addEventListener('change', function() {
        const selectedIndex = parseInt(this.value);
        if (!isNaN(selectedIndex) && currentChannel) {
            selectSource(selectedIndex);
        }
    });
}

// Setup quality dropdown
function setupQualitySelector() {
    const qualitySelect = document.getElementById('qualitySelect');
    
    // Add change event listener
    qualitySelect.addEventListener('change', function() {
        const quality = this.value;
        setVideoQuality(quality);
    });
}

// Setup category tabs
function setupCategoryTabs() {
    const categoryTabsContainer = document.getElementById('categoryTabs');
    const channelsGridContainer = document.getElementById('channelsGrid');
    
    // Clear existing tabs
    categoryTabsContainer.innerHTML = '';
    
    // Add "All" category
    const allTab = document.createElement('div');
    allTab.className = 'category-tab active';
    allTab.textContent = '全部';
    allTab.dataset.category = 'all';
    categoryTabsContainer.appendChild(allTab);
    
    // Add category tabs
    categories.forEach(category => {
        const tab = document.createElement('div');
        tab.className = 'category-tab';
        tab.textContent = category.name;
        tab.dataset.category = category.id;
        categoryTabsContainer.appendChild(tab);
    });
    
    // Add click event listeners to tabs
    const tabs = categoryTabsContainer.querySelectorAll('.category-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
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
}

// Display channels filtered by category
function displayChannelsByCategory(categoryId) {
    const channelsGridContainer = document.getElementById('channelsGrid');
    
    // Clear existing channels
    channelsGridContainer.innerHTML = '';
    
    // Filter channels by category
    const filteredChannels = categoryId === 'all' 
        ? channels 
        : channels.filter(channel => channel.categoryId === categoryId);
    
    // Add channel items to grid
    filteredChannels.forEach((channel, index) => {
        const channelItem = document.createElement('div');
        channelItem.className = 'channel-item';
        channelItem.dataset.index = channels.indexOf(channel);
        
        // Use logo if available, otherwise use placeholder
        const logoHtml = channel.logo 
            ? `<img src="${channel.logo}" alt="${channel.name}" class="channel-logo">` 
            : `<div class="channel-logo-placeholder">${channel.name.charAt(0)}</div>`;
        
        channelItem.innerHTML = `
            ${logoHtml}
            <div class="channel-name">${channel.name}</div>
        `;
        
        // Add click event listener
        channelItem.addEventListener('click', function() {
            const channelIndex = parseInt(this.dataset.index);
            selectChannel(channelIndex);
            
            // Update active state
            const items = channelsGridContainer.querySelectorAll('.channel-item');
            items.forEach(item => item.classList.remove('active'));
            this.classList.add('active');
        });
        
        channelsGridContainer.appendChild(channelItem);
    });
}

// Select a channel
function selectChannel(index) {
    currentChannel = channels[index];
    
    // Update channel selector
    document.getElementById('channelSelect').value = index;
    
    // Update source selector
    updateSourceSelector(currentChannel.sources);
    
    // Select first source by default
    if (currentChannel.sources && currentChannel.sources.length > 0) {
        selectSource(0);
    }
    
    // Highlight active channel in grid
    const channelItems = document.querySelectorAll('.channel-item');
    channelItems.forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.index) === index);
    });
}

// Update source dropdown based on selected channel
function updateSourceSelector(sources) {
    const sourceSelect = document.getElementById('sourceSelect');
    
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
    }
}

// Select a source and play video
function selectSource(index) {
    if (!currentChannel || !currentChannel.sources || index >= currentChannel.sources.length) {
        return;
    }
    
    currentSource = currentChannel.sources[index];
    document.getElementById('sourceSelect').value = index;
    
    // Determine the best URL based on device
    const url = getBestStreamUrl(currentSource);
    
    // Stop current video if playing
    if (player) {
        player.pause();
        player.src('');
    }
    
    // Set the source based on type
    setPlayerSource(url);
}

// Determine best stream URL based on device capabilities
function getBestStreamUrl(source) {
    // Parse source URLs
    const urls = {
        hls: source.hls || null,
        flv: source.flv || null,
        dash: source.dash || null,
        mp4: source.mp4 || null
    };
    
    // Choose best format based on device
    if (deviceInfo.isIOS && urls.hls) {
        // iOS has native HLS support
        return urls.hls;
    } else if (deviceInfo.isAndroid) {
        // Android prefers HLS or MP4
        return urls.hls || urls.mp4 || urls.dash || urls.flv;
    } else if (deviceInfo.isOldBrowser) {
        // Old browsers prefer MP4 if available
        return urls.mp4 || urls.hls || urls.flv;
    } else {
        // Desktop browsers can handle any format
        return urls.hls || urls.dash || urls.flv || urls.mp4;
    }
}

// Set player source with appropriate type
function setPlayerSource(url) {
    if (!url) {
        console.error('No valid stream URL found');
        return;
    }
    
    let type = '';
    
    // Determine source type from URL
    if (url.includes('.m3u8')) {
        type = 'application/x-mpegURL';
    } else if (url.includes('.flv')) {
        type = 'video/x-flv';
    } else if (url.includes('.mpd')) {
        type = 'application/dash+xml';
    } else if (url.includes('.mp4')) {
        type = 'video/mp4';
    }
    
    // Set source and play
    player.src({
        src: url,
        type: type
    });
    
    // Auto-play after source change
    const playPromise = player.play();
    
    // Handle auto-play restrictions
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.log('Auto-play prevented by browser:', error);
            // Show play button
            const playButton = document.querySelector('.vjs-big-play-button');
            if (playButton) {
                playButton.style.display = 'block';
            }
        });
    }
}

// Set video quality
function setVideoQuality(quality) {
    if (!player || !player.qualityLevels) {
        return;
    }
    
    const qualityLevels = player.qualityLevels();
    
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
}

// Handle player errors
function handlePlayerError(error) {
    console.error('Video player error:', error);
    
    let errorMessage = '播放出错，请尝试其他信号源';
    
    // Only try to switch source if we have a current channel with multiple sources
    if (currentChannel && currentChannel.sources && currentChannel.sources.length > 1) {
        const currentIndex = parseInt(document.getElementById('sourceSelect').value);
        const nextIndex = (currentIndex + 1) % currentChannel.sources.length;
        
        // Try next source
        selectSource(nextIndex);
        
        errorMessage += '，已自动切换到下一个信号源';
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
    playerContainer.appendChild(errorOverlay);
    
    // Remove error message after 5 seconds
    setTimeout(() => {
        playerContainer.removeChild(errorOverlay);
    }, 5000);
} 