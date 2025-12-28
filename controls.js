// 玩家输入状态管理类
class PlayerInputState {
    constructor(playerId) {
        this.playerId = playerId;
        
        // 原始输入状态
        this.rawInput = {
            left: false,
            right: false,
            jump: false,
            punch: false,
            kick: false,
            defend: false
        };
        
        // 处理后的有效输入
        this.processedInput = {
            left: false,
            right: false,
            jump: false,
            punch: false,
            kick: false,
            defend: false
        };
        
        // 输入优先级
        this.actionPriority = null;
        this.lastActionTime = 0;
    }
    
    updateRawInput(inputType, value) {
        this.rawInput[inputType] = value;
        this.processInputPriorities();
    }
    
    processInputPriorities() {
        // 重置处理后的输入
        Object.keys(this.processedInput).forEach(key => {
            this.processedInput[key] = false;
        });
        
        // 支持并行输入：同时处理移动和动作
        // 动作输入（攻击和防御）
        this.processedInput.punch = this.rawInput.punch;
        this.processedInput.kick = this.rawInput.kick;
        this.processedInput.defend = this.rawInput.defend;
        
        // 移动输入（方向和跳跃）
        this.processedInput.left = this.rawInput.left;
        this.processedInput.right = this.rawInput.right;
        this.processedInput.jump = this.rawInput.jump;
        
        // 确定当前主要动作优先级（仅用于状态管理）
        if (this.rawInput.punch || this.rawInput.kick) {
            this.actionPriority = 'ATTACK';
        } else if (this.rawInput.defend) {
            this.actionPriority = 'DEFEND';
        } else if (this.rawInput.left || this.rawInput.right || this.rawInput.jump) {
            this.actionPriority = 'MOVEMENT';
        } else {
            this.actionPriority = null;
        }
        
        this.lastActionTime = Date.now();
    }
}

class TouchInputHandler {
    constructor() {
        this.buttons = document.querySelectorAll('.control-btn');
        this.activeTouches = new Map(); // touchId -> buttonInfo
        this.playerInputStates = new Map(); // playerId -> PlayerInputState
        this.setupEventListeners();
        this.initializePlayerStates();
    }
    
    initializePlayerStates() {
        // 为两个玩家创建输入状态
        this.playerInputStates.set(1, new PlayerInputState(1));
        this.playerInputStates.set(2, new PlayerInputState(2));
    }
    
    setupEventListeners() {
        // 为每个控制器区域添加独立的触摸监听
        const controllerAreas = document.querySelectorAll('.player-controls');
        controllerAreas.forEach(area => {
            area.addEventListener('touchstart', (e) => this.handleAreaTouchStart(e));
            area.addEventListener('touchmove', (e) => this.handleAreaTouchMove(e));
            area.addEventListener('touchend', (e) => this.handleAreaTouchEnd(e));
            area.addEventListener('touchcancel', (e) => this.handleAreaTouchEnd(e));
        });
        
        // 鼠标事件（用于测试）
        this.buttons.forEach(button => {
            button.addEventListener('mousedown', (e) => this.handleMouseDown(e, button));
            button.addEventListener('mouseup', (e) => this.handleMouseUp(e, button));
            button.addEventListener('mouseleave', (e) => this.handleMouseUp(e, button));
        });
        
        // 只在游戏画布区域防止默认行为，避免影响整个页面
        const gameCanvas = document.getElementById('gameCanvas');
        if (gameCanvas) {
            gameCanvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
            gameCanvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
        }
    }
    
    handleAreaTouchStart(e) {
        // 只阻止当前区域的默认行为，不影响其他区域
        e.preventDefault();
        const area = e.currentTarget;
        const playerId = parseInt(area.classList.contains('player1-controls') ? '1' : '2');
        
        // 处理该区域的所有触摸点
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            const touchId = touch.identifier;
            
            // 检测触摸点下的按钮
            const button = this.getButtonAtPoint(touch.clientX, touch.clientY, playerId);
            if (button) {
                const buttonInfo = {
                    button: button,
                    playerId: playerId,
                    action: button.dataset.action,
                    startTime: Date.now()
                };
                
                // 确保每个玩家的触摸状态独立管理
                this.activeTouches.set(touchId, buttonInfo);
                this.updatePlayerInput(playerId, button.dataset.action, true);
                this.setButtonPressed(button, true);
            }
        }
    }
    
    handleAreaTouchMove(e) {
        e.preventDefault();
        
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            const touchId = touch.identifier;
            const touchInfo = this.activeTouches.get(touchId);
            
            if (touchInfo) {
                const newButton = this.getButtonAtPoint(touch.clientX, touch.clientY, touchInfo.playerId);
                
                if (newButton !== touchInfo.button) {
                    // 释放旧按钮
                    this.setButtonPressed(touchInfo.button, false);
                    this.updatePlayerInput(touchInfo.playerId, touchInfo.action, false);
                    
                    // 激活新按钮
                    if (newButton) {
                        touchInfo.button = newButton;
                        touchInfo.action = newButton.dataset.action;
                        this.setButtonPressed(newButton, true);
                        this.updatePlayerInput(touchInfo.playerId, newButton.dataset.action, true);
                    }
                }
            }
        }
    }
    
    handleAreaTouchEnd(e) {
        e.preventDefault();
        
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const touchId = touch.identifier;
            const touchInfo = this.activeTouches.get(touchId);
            
            if (touchInfo) {
                this.setButtonPressed(touchInfo.button, false);
                this.updatePlayerInput(touchInfo.playerId, touchInfo.action, false);
                this.activeTouches.delete(touchId);
            }
        }
    }
    
    handleMouseDown(e, button) {
        e.preventDefault();
        const playerId = parseInt(button.dataset.player);
        const action = button.dataset.action;
        
        this.setButtonPressed(button, true);
        this.updatePlayerInput(playerId, action, true);
    }
    
    handleMouseUp(e, button) {
        e.preventDefault();
        const playerId = parseInt(button.dataset.player);
        const action = button.dataset.action;
        
        this.setButtonPressed(button, false);
        this.updatePlayerInput(playerId, action, false);
    }
    
    getButtonAtPoint(x, y, playerId) {
        const buttons = document.querySelectorAll(`.control-btn[data-player="${playerId}"]`);
        for (const button of buttons) {
            const rect = button.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                return button;
            }
        }
        return null;
    }
    
    updatePlayerInput(playerId, action, value) {
        const inputState = this.playerInputStates.get(playerId);
        if (inputState) {
            inputState.updateRawInput(action, value);
        }
        
        // 保持向后兼容 - 直接更新玩家输入
        if (game && game.players[playerId - 1]) {
            const player = game.players[playerId - 1];
            if (player.input) {
                player.input[action] = value;
            }
        }
    }
    
    setButtonPressed(button, pressed) {
        if (pressed) {
            button.classList.add('pressed');
        } else {
            button.classList.remove('pressed');
        }
    }
    
    
    
    getPlayerInputState(playerId) {
        return this.playerInputStates.get(playerId);
    }
    
    // 清理所有触摸
    clearAllTouches() {
        this.activeTouches.clear();
        this.buttons.forEach(button => {
            this.setButtonPressed(button, false);
        });
    }
}

// 键盘控制（用于测试）
class KeyboardInputHandler {
    constructor() {
        this.keys = {};
        this.playerInputStates = new Map(); // playerId -> PlayerInputState
        this.setupEventListeners();
        this.initializePlayerStates();
    }
    
    initializePlayerStates() {
        // 为两个玩家创建输入状态
        this.playerInputStates.set(1, new PlayerInputState(1));
        this.playerInputStates.set(2, new PlayerInputState(2));
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }
    
    handleKeyDown(e) {
        // 立即更新按键状态，确保同时按键支持
        this.keys[e.code] = true;
        this.updatePlayerInput();

        // 空格键暂停/恢复游戏
        if (e.code === 'Space') {
            e.preventDefault();
            if (window.game) {
                window.game.pause();
            }
        }

        // P 键打开/关闭教程
        if (e.code === 'KeyP') {
            e.preventDefault();
            if (window.game) {
                window.game.toggleTutorial();
            }
        }

        // 反引号键切换调试模式
        if (e.code === 'Backquote') {
            e.preventDefault();
            if (window.game) {
                window.game.toggleDebugMode();
            }
        }
    }
    
    handleKeyUp(e) {
        // 立即更新按键状态，确保同时按键支持
        this.keys[e.code] = false;
        this.updatePlayerInput();
    }
    
    updatePlayerInput() {
        // 玩家1输入映射
        const player1Inputs = {
            left: this.keys['KeyA'] || false,
            right: this.keys['KeyD'] || false,
            jump: this.keys['KeyW'] || false,
            defend: this.keys['KeyS'] || false,
            punch: this.keys['KeyQ'] || false,
            kick: this.keys['KeyE'] || false
        };
        
        // 玩家2输入映射（支持新旧按键）
        const player2Inputs = {
            left: (this.keys['ArrowLeft'] || this.keys['Numpad4']) || false,
            right: (this.keys['ArrowRight'] || this.keys['Numpad6']) || false,
            jump: (this.keys['ArrowUp'] || this.keys['Numpad8']) || false,
            punch: (this.keys['Numpad1'] || this.keys['Numpad7']) || false,
            kick: (this.keys['Numpad2'] || this.keys['Numpad9']) || false,
            defend: (this.keys['Numpad3'] || this.keys['Numpad5']) || false
        };
        
        // 更新玩家输入状态
        this.updatePlayerInputState(1, player1Inputs);
        this.updatePlayerInputState(2, player2Inputs);
        
        // 保持向后兼容 - 直接更新玩家输入
        if (game && game.players) {
            const player1 = game.players[0];
            if (player1 && player1.input) {
                Object.assign(player1.input, player1Inputs);
            }
            
            const player2 = game.players[1];
            if (player2 && player2.input) {
                Object.assign(player2.input, player2Inputs);
            }
        }
    }
    
    updatePlayerInputState(playerId, inputs) {
        const inputState = this.playerInputStates.get(playerId);
        if (inputState) {
            Object.keys(inputs).forEach(action => {
                inputState.updateRawInput(action, inputs[action]);
            });
        }
    }
    
    getPlayerInputState(playerId) {
        return this.playerInputStates.get(playerId);
    }
}

// 输入管理器
class InputManager {
    constructor() {
        this.touchInputHandler = null;
        this.keyboardInputHandler = null;
    }
    
    initialize() {
        this.touchInputHandler = new TouchInputHandler();
        this.keyboardInputHandler = new KeyboardInputHandler();
        
        console.log('输入管理系统已初始化');
        console.log('触摸屏控制: 使用屏幕上的虚拟按钮');
        console.log('键盘控制测试: 玩家1 红方 (A左移,D右移,W跳跃,S防御,Q拳,E腿) / 玩家2 蓝方 (方向键 + 小键盘1,2,3)');
    }
    
    getPlayerInputState(playerId) {
        // 优先从触摸屏获取输入状态
        let inputState = this.touchInputHandler?.getPlayerInputState(playerId);
        
        // 如果触摸屏没有输入，则从键盘获取
        if (!inputState || this.hasNoActiveInput(inputState)) {
            inputState = this.keyboardInputHandler?.getPlayerInputState(playerId);
        }
        
        return inputState;
    }
    
    hasNoActiveInput(inputState) {
        if (!inputState) return true;
        
        // 检查是否有任何激活的输入
        return Object.values(inputState.processedInput).every(value => !value);
    }
    
    // 清理所有输入
    clearAllInputs() {
        if (this.touchInputHandler) {
            this.touchInputHandler.clearAllTouches();
        }
    }
}

// 初始化控制系统
let inputManager;

function initializeControls() {
    inputManager = new InputManager();
    inputManager.initialize();
    
    // 保持向后兼容
    touchControls = inputManager.touchInputHandler;
    keyboardControls = inputManager.keyboardInputHandler;
}