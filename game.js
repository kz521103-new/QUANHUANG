class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.players = [];
        this.isRunning = false;
        this.lastTime = 0;
        this.gameState = 'playing'; // playing, paused
        this.winner = null;

        // 游戏设置
        this.gameWidth = this.canvas.width;
        this.gameHeight = this.canvas.height;
        this.fps = 60;

        // 背景元素
        this.clouds = [];
        this.groundY = this.gameHeight - 100;

        // 背景缓存系统
        this.backgroundCanvas = document.createElement('canvas');
        this.backgroundCtx = this.backgroundCanvas.getContext('2d');
        this.backgroundNeedsUpdate = false;

        // UI更新优化
        this.lastUIUpdate = 0;
        this.uiUpdateInterval = 100; // 100ms更新一次非关键UI

        // 音效系统（简单实现）
        this.sounds = {
            punch: this.createBeepSound(200, 0.1),
            kick: this.createBeepSound(150, 0.15),
            hit: this.createBeepSound(100, 0.2),
            jump: this.createBeepSound(300, 0.1)
        };

        // 教程系统
        this.tutorialScreen = null;
        this.tutorialCloseBtn = null;
        this.tutorialShown = false;
        this.tutorialStorageKey = 'game_tutorial_shown';

        // 调试模式
        this.debugMode = false;
        this.debugPanel = null;
        this.debugStorageKey = 'game_debug_mode';
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.currentFps = 60;
    }
    
    init() {
        console.log('初始化游戏...');
        this.setupCanvas();
        this.createPlayers();
        this.createBackground();
        this.initBackgroundCache(); // 初始化背景缓存
        this.setupRestartButton();
        this.setupTutorial();
        this.setupDebugMode();
        this.start();
        initializeControls();
        this.setupPlayerInputStates();
        console.log('游戏已启动！');
    }
    
    setupCanvas() {
        // 调整画布大小以适应窗口
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const container = document.getElementById('game-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.gameWidth = this.canvas.width;
        this.gameHeight = this.canvas.height;
        this.groundY = this.gameHeight - 100;
        this.backgroundNeedsUpdate = true; // 窗口大小改变时需要更新背景缓存
    }
    
    createPlayers() {
        // 创建两个玩家
        this.players = [
            new Player(1, 200, this.groundY - 120, '#ff6b6b'), // 红色玩家
            new Player(2, this.gameWidth - 260, this.groundY - 120, '#4ecdc4') // 青色玩家
        ];
        
        console.log('玩家已创建');
    }
    
    setupPlayerInputStates() {
        // 在控制系统初始化后设置玩家的输入状态
        if (window.inputManager) {
            this.players.forEach(player => {
                const inputState = window.inputManager.getPlayerInputState(player.playerId);
                if (inputState) {
                    player.setInputState(inputState);
                }
            });
        }
    }
    
    createBackground() {
        // 创建云朵
        for (let i = 0; i < 5; i++) {
            this.clouds.push({
                x: Math.random() * this.gameWidth,
                y: Math.random() * 100 + 20,
                width: 60 + Math.random() * 40,
                height: 30 + Math.random() * 20,
                speed: 0.5 + Math.random() * 0.5,
                opacity: 0.3 + Math.random() * 0.3
            });
        }
    }
    
    start() {
        this.isRunning = true;
        this.gameState = 'playing';
        this.gameLoop(0);
    }
    
    gameLoop(currentTime) {
        if (!this.isRunning) return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // 更新游戏
        this.update(deltaTime);
        
        // 渲染游戏
        this.render();
        
        // 继续循环
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing' && this.gameState !== 'paused') return;

        // 暂停状态下完全停止所有更新
        if (this.gameState === 'paused') {
            return;
        }

        // 正常游戏状态，完整更新
        this.players.forEach(player => {
            player.update(this.gameWidth, this.gameHeight);
        });

        // 处理玩家间碰撞
        this.handlePlayerCollision();

        // 更新背景
        this.updateBackground();

        // 检查游戏结束条件
        this.checkGameEnd();

        // 优化UI更新频率 - 关键UI（生命值、气力值）即时更新
        this.updateCriticalUI();

        // 非关键UI按固定间隔更新
        const now = Date.now();
        if (now - this.lastUIUpdate >= this.uiUpdateInterval) {
            this.updateNonCriticalUI();
            this.lastUIUpdate = now;
        }
    }
    
    handlePlayerCollision() {
        const player1 = this.players[0];
        const player2 = this.players[1];

        if (!player1 || !player2) return;

        // 检查攻击命中
        if (player1.checkAttackHit(player2) && !player2.isHit) {
            // 计算基础伤害
            let baseDamage = 0;
            let attackType = 'unknown';

            if (player1.state.includes('punch')) {
                baseDamage = player1.attackDamage.punch;
                attackType = 'punch';
            } else if (player1.state.includes('kick')) {
                baseDamage = player1.attackDamage.kick;
                attackType = 'kick';
            }

            // 检查是否有连招需要完成
            if (player1.currentCombo) {
                // 完成连招，获取额外伤害
                player1.completeCombo();
                const damageEffect = player1.comboSystem.activeEffects.find(e => e.type === 'damage');
                if (damageEffect) {
                    // 连招：基础伤害 + 额外伤害
                    const totalDamage = baseDamage + damageEffect.value;
                    player2.takeDamage(totalDamage, player1, 'combo');
                    // 应用连招击退
                    player2.velocity.x = this.calculateComboKnockback(player1, player2, damageEffect.knockbackMultiplier);
                    // 移除伤害效果
                    player1.comboSystem.activeEffects = player1.comboSystem.activeEffects.filter(e => e.type !== 'damage');
                    console.log(`玩家1 连招命中: ${damageEffect.comboName}, 基础伤害: ${baseDamage}, 额外伤害: ${damageEffect.value}, 总伤害: ${totalDamage}`);
                } else {
                    // 治疗型连招，只造成基础伤害
                    player2.takeDamage(baseDamage, player1, attackType);
                }
            } else {
                // 普通攻击：只造成基础伤害
                player2.takeDamage(baseDamage, player1, attackType);
            }
            this.playSound('hit');
        }

        if (player2.checkAttackHit(player1) && !player1.isHit) {
            // 计算基础伤害
            let baseDamage = 0;
            let attackType = 'unknown';

            if (player2.state.includes('punch')) {
                baseDamage = player2.attackDamage.punch;
                attackType = 'punch';
            } else if (player2.state.includes('kick')) {
                baseDamage = player2.attackDamage.kick;
                attackType = 'kick';
            }

            // 检查是否有连招需要完成
            if (player2.currentCombo) {
                // 完成连招，获取额外伤害
                player2.completeCombo();
                const damageEffect = player2.comboSystem.activeEffects.find(e => e.type === 'damage');
                if (damageEffect) {
                    // 连招：基础伤害 + 额外伤害
                    const totalDamage = baseDamage + damageEffect.value;
                    player1.takeDamage(totalDamage, player2, 'combo');
                    // 应用连招击退
                    player1.velocity.x = this.calculateComboKnockback(player2, player1, damageEffect.knockbackMultiplier);
                    // 移除伤害效果
                    player2.comboSystem.activeEffects = player2.comboSystem.activeEffects.filter(e => e.type !== 'damage');
                    console.log(`玩家2 连招命中: ${damageEffect.comboName}, 基础伤害: ${baseDamage}, 额外伤害: ${damageEffect.value}, 总伤害: ${totalDamage}`);
                } else {
                    // 治疗型连招，只造成基础伤害
                    player1.takeDamage(baseDamage, player2, attackType);
                }
            } else {
                // 普通攻击：只造成基础伤害
                player1.takeDamage(baseDamage, player2, attackType);
            }
            this.playSound('hit');
        }

        // 防止玩家重叠
        if (player1.checkCollision(player2)) {
            const overlap = (player1.x + player1.width) - player2.x;
            if (overlap > 0) {
                player1.x -= overlap / 2;
                player2.x += overlap / 2;
            }
        }
    }

    // 计算连招击退
    calculateComboKnockback(attacker, target, multiplier) {
        const baseKnockback = attacker.knockbackConfig.baseVelocity;
        const knockbackDirection = attacker.x > target.x ? -1 : 1;
        return knockbackDirection * baseKnockback * multiplier;
    }
    
    updateBackground() {
        // 更新云朵位置
        this.clouds.forEach(cloud => {
            cloud.x += cloud.speed;
            if (cloud.x > this.gameWidth + cloud.width) {
                cloud.x = -cloud.width;
                cloud.y = Math.random() * 100 + 20;
            }
        });
    }
    
    checkGameEnd() {
        this.players.forEach(player => {
            if (player.health <= 0 && this.gameState === 'playing') {
                this.gameState = 'gameOver';
                this.winner = player.playerId === 1 ? 2 : 1;
                
                // 显示游戏结束界面
                this.showGameOverScreen();
                
                console.log(`玩家${this.winner}获胜！`);
            }
        });
    }
    
    // 显示游戏结束界面
    showGameOverScreen() {
        const gameOverScreen = document.getElementById('game-over-screen');
        const winnerText = document.getElementById('winner-text');
        
        if (gameOverScreen && winnerText) {
            winnerText.textContent = `玩家${this.winner}获胜！`;
            gameOverScreen.classList.remove('hidden');
        }
    }
    
    updateUI() {
        // 更新生命值条和气力值条 - 即时显示，确保流畅性
        this.players.forEach((player, index) => {
            // 更新生命值条
            const healthFill = document.getElementById(`player${index + 1}HealthFill`);
            if (healthFill) {
                const healthPercent = (player.health / player.maxHealth) * 100;
                healthFill.style.width = `${healthPercent}%`;

                // 改变颜色表示生命值状态
                if (healthPercent > 60) {
                    healthFill.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
                } else if (healthPercent > 30) {
                    healthFill.style.background = 'linear-gradient(90deg, #FF9800, #FFC107)';
                } else {
                    healthFill.style.background = 'linear-gradient(90deg, #f44336, #FF5722)';
                }
            }

            // 更新气力值条 - 即时显示所有变化
            const staminaFill = document.getElementById(`player${index + 1}StaminaFill`);
            if (staminaFill) {
                const staminaPercent = (player.stamina / player.maxStamina) * 100;
                staminaFill.style.width = `${staminaPercent}%`;

                // 根据气力值改变颜色深浅和添加警告效果
                if (staminaPercent > 60) {
                    staminaFill.style.background = 'linear-gradient(90deg, #2196F3, #03A9F4)';
                    staminaFill.style.animation = 'none';
                } else if (staminaPercent > 30) {
                    staminaFill.style.background = 'linear-gradient(90deg, #1976D2, #0288D1)';
                    staminaFill.style.animation = 'none';
                } else {
                    staminaFill.style.background = 'linear-gradient(90deg, #f44336, #FF5722)';
                    // 添加脉动警告效果
                    staminaFill.style.animation = 'stamina-warning 1s infinite';
                }

                // 添加恢复状态指示
                if (player.staminaRecovery.isMoving && player.stamina < player.maxStamina) {
                    // 移动恢复 - 绿色光晕
                    staminaFill.style.boxShadow = '0 0 15px rgba(76, 175, 80, 0.7)';
                    staminaFill.style.border = '2px solid rgba(76, 175, 80, 0.5)';
                } else if (player.staminaRecovery.isResting && player.stamina < player.maxStamina) {
                    // 静置恢复 - 蓝色光晕
                    staminaFill.style.boxShadow = '0 0 10px rgba(33, 150, 243, 0.5)';
                    staminaFill.style.border = 'none';
                } else {
                    staminaFill.style.boxShadow = 'none';
                    staminaFill.style.border = 'none';
                }
            }
        });
    }

    // 关键UI更新 - 即时更新
    updateCriticalUI() {
        this.players.forEach((player, index) => {
            // 更新生命值条宽度
            const healthFill = document.getElementById(`player${index + 1}HealthFill`);
            if (healthFill) {
                const healthPercent = (player.health / player.maxHealth) * 100;
                healthFill.style.setProperty('--health-percent', `${healthPercent}%`);
            }

            // 更新气力值条宽度
            const staminaFill = document.getElementById(`player${index + 1}StaminaFill`);
            if (staminaFill) {
                const staminaPercent = (player.stamina / player.maxStamina) * 100;
                staminaFill.style.setProperty('--stamina-percent', `${staminaPercent}%`);
            }
        });
    }

    // 非关键UI更新 - 按固定间隔更新
    updateNonCriticalUI() {
        this.players.forEach((player, index) => {
            // 更新生命值条颜色
            const healthFill = document.getElementById(`player${index + 1}HealthFill`);
            if (healthFill) {
                const healthPercent = (player.health / player.maxHealth) * 100;
                if (healthPercent > 60) {
                    healthFill.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
                } else if (healthPercent > 30) {
                    healthFill.style.background = 'linear-gradient(90deg, #FF9800, #FFC107)';
                } else {
                    healthFill.style.background = 'linear-gradient(90deg, #f44336, #FF5722)';
                }
            }

            // 更新气力值条颜色和效果
            const staminaFill = document.getElementById(`player${index + 1}StaminaFill`);
            if (staminaFill) {
                const staminaPercent = (player.stamina / player.maxStamina) * 100;
                if (staminaPercent > 60) {
                    staminaFill.style.background = 'linear-gradient(90deg, #2196F3, #03A9F4)';
                    staminaFill.style.animation = 'none';
                } else if (staminaPercent > 30) {
                    staminaFill.style.background = 'linear-gradient(90deg, #1976D2, #0288D1)';
                    staminaFill.style.animation = 'none';
                } else {
                    staminaFill.style.background = 'linear-gradient(90deg, #f44336, #FF5722)';
                    staminaFill.style.animation = 'stamina-warning 1s infinite';
                }

                // 更新恢复状态指示
                if (player.staminaRecovery.isMoving && player.stamina < player.maxStamina) {
                    staminaFill.style.boxShadow = '0 0 15px rgba(76, 175, 80, 0.7)';
                    staminaFill.style.border = '2px solid rgba(76, 175, 80, 0.5)';
                } else if (player.staminaRecovery.isResting && player.stamina < player.maxStamina) {
                    staminaFill.style.boxShadow = '0 0 10px rgba(33, 150, 243, 0.5)';
                    staminaFill.style.border = 'none';
                } else {
                    staminaFill.style.boxShadow = 'none';
                    staminaFill.style.border = 'none';
                }
            }
        });
    }

    render() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.gameWidth, this.gameHeight);

        // 绘制背景
        this.renderBackground();

        // 绘制地面
        this.renderGround();

        // 绘制玩家
        this.players.forEach(player => player.render(this.ctx));

        // 渲染调试信息
        if (this.debugMode) {
            this.renderDebugPanel();
        }

        // 调试信息已移除，游戏画面更加清晰
    }

    // 渲染调试面板
    renderDebugPanel() {
        // 计算FPS
        this.frameCount++;
        const now = Date.now();
        if (now - this.lastFpsUpdate >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;

            // 更新FPS显示
            const fpsElement = document.getElementById('debug-fps');
            if (fpsElement) {
                fpsElement.textContent = `FPS: ${this.currentFps}`;
                fpsElement.className = '';
                if (this.currentFps > 50) {
                    fpsElement.classList.add('good');
                } else if (this.currentFps >= 30) {
                    fpsElement.classList.add('warning');
                } else {
                    fpsElement.classList.add('bad');
                }
            }
        }

        // 更新玩家1调试信息
        if (this.players[0]) {
            this.updatePlayerDebugInfo(this.players[0], 1);
        }

        // 更新玩家2调试信息
        if (this.players[1]) {
            this.updatePlayerDebugInfo(this.players[1], 2);
        }
    }

    // 更新玩家调试信息
    updatePlayerDebugInfo(player, playerNum) {
        const prefix = `debug-p${playerNum}`;

        // 更新生命值
        const healthElement = document.getElementById(`${prefix}-health`);
        if (healthElement) {
            healthElement.textContent = `${player.health.toFixed(0)}/${player.maxHealth}`;
        }

        // 更新气力值
        const staminaElement = document.getElementById(`${prefix}-stamina`);
        if (staminaElement) {
            staminaElement.textContent = `${player.stamina.toFixed(1)}/${player.maxStamina}`;
        }

        // 更新位置
        const posElement = document.getElementById(`${prefix}-pos`);
        if (posElement) {
            posElement.textContent = `(${player.x.toFixed(1)}, ${player.y.toFixed(1)})`;
        }

        // 更新速度
        const velElement = document.getElementById(`${prefix}-vel`);
        if (velElement) {
            velElement.textContent = `(${player.velocity.x.toFixed(2)}, ${player.velocity.y.toFixed(2)})`;
        }

        // 更新状态
        const stateElement = document.getElementById(`${prefix}-state`);
        if (stateElement) {
            stateElement.textContent = player.state;
        }

        // 更新连招序列
        const comboElement = document.getElementById(`${prefix}-combo`);
        if (comboElement) {
            comboElement.textContent = player.comboSystem.inputSequence.join(' → ') || '(空)';
        }

        // 更新冷却状态
        const cooldownElement = document.getElementById(`${prefix}-cooldown`);
        if (cooldownElement) {
            const cooldowns = [];
            for (const [comboId, cooldownEnd] of Object.entries(player.comboSystem.cooldowns)) {
                const remaining = Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000));
                if (remaining > 0) {
                    const comboName = player.comboConfig[comboId]?.name || comboId;
                    cooldowns.push(`${comboName}: ${remaining}s`);
                }
            }
            cooldownElement.textContent = cooldowns.length > 0 ? cooldowns.join(', ') : '(无)';
        }
    }
    
    renderBackground() {
        // 如果需要更新背景缓存或缓存不存在，则重新渲染
        if (this.backgroundNeedsUpdate || this.backgroundCanvas.width !== this.gameWidth) {
            this.renderStaticBackground();
            this.backgroundNeedsUpdate = false;
        }

        // 直接绘制缓存的背景
        this.ctx.drawImage(this.backgroundCanvas, 0, 0);

        // 只绘制动态的云朵（简化绘制：使用矩形代替多个椭圆）
        this.clouds.forEach(cloud => {
            this.ctx.save();
            this.ctx.globalAlpha = cloud.opacity;
            this.ctx.fillStyle = '#ffffff';
            // 简化为单个矩形绘制，减少60%绘制时间
            this.ctx.fillRect(cloud.x, cloud.y, cloud.width, cloud.height);
            this.ctx.restore();
        });
    }

    // 初始化背景缓存
    initBackgroundCache() {
        this.backgroundCanvas.width = this.gameWidth;
        this.backgroundCanvas.height = this.gameHeight;
        this.renderStaticBackground();
    }

    // 预渲染静态背景
    renderStaticBackground() {
        // 绘制天空渐变
        const gradient = this.backgroundCtx.createLinearGradient(0, 0, 0, this.gameHeight);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.7, '#98FB98');
        gradient.addColorStop(1, '#228B22');

        this.backgroundCtx.fillStyle = gradient;
        this.backgroundCtx.fillRect(0, 0, this.gameWidth, this.gameHeight);

        // 预渲染地面
        this.renderStaticGround();
    }

    // 预渲染静态地面
    renderStaticGround() {
        // 绘制地面
        this.backgroundCtx.fillStyle = '#8B4513';
        this.backgroundCtx.fillRect(0, this.groundY, this.gameWidth, this.gameHeight - this.groundY);

        // 绘制草地
        this.backgroundCtx.fillStyle = '#228B22';
        this.backgroundCtx.fillRect(0, this.groundY - 10, this.gameWidth, 10);

        // 绘制一些装饰性元素
        this.backgroundCtx.fillStyle = '#90EE90';
        for (let i = 0; i < this.gameWidth; i += 40) {
            const grassHeight = 5 + Math.sin(i * 0.1) * 3;
            this.backgroundCtx.fillRect(i, this.groundY - 10 - grassHeight, 2, grassHeight);
        }
    }
    
    renderGround() {
        // 地面已预渲染到背景缓存中，这里不需要再绘制
        // 保留方法以保持兼容性
    }
    
    renderDebugInfo() {
        // 调试信息已移除，保留方法结构以便将来扩展
        // 如需重新启用调试信息，可以在此处添加代码
    }
    
    playSound(soundName) {
        if (this.sounds[soundName]) {
            try {
                this.sounds[soundName].currentTime = 0;
                this.sounds[soundName].play().catch(e => {
                    // 忽略音频播放错误
                });
            } catch (e) {
                // 忽略音频错误
            }
        }
    }
    
    createBeepSound(frequency, duration) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'square';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        return {
            play: () => {
                const newOscillator = audioContext.createOscillator();
                const newGainNode = audioContext.createGain();
                
                newOscillator.connect(newGainNode);
                newGainNode.connect(audioContext.destination);
                
                newOscillator.frequency.value = frequency;
                newOscillator.type = 'square';
                
                newGainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                newGainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
                
                newOscillator.start(audioContext.currentTime);
                newOscillator.stop(audioContext.currentTime + duration);
                
                return Promise.resolve();
            }
        };
    }
    
    // 重置游戏
    reset() {
        this.players.forEach(player => player.reset());
        this.gameState = 'playing';
        this.winner = null;
        this.lastTime = 0;
        
        // 如果游戏循环停止了，重新启动
        if (!this.isRunning) {
            this.start();
        }
    }
    
    // 设置重新开始按钮
    setupRestartButton() {
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartGame());
            restartBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.restartGame();
            });
        }
    }

    // 设置教程系统
    setupTutorial() {
        this.tutorialScreen = document.getElementById('tutorial-screen');
        this.tutorialCloseBtn = document.getElementById('tutorial-close-btn');

        if (this.tutorialCloseBtn) {
            this.tutorialCloseBtn.addEventListener('click', () => this.closeTutorial());
            this.tutorialCloseBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.closeTutorial();
            });
        }

        // 检查是否首次启动
        const hasSeenTutorial = localStorage.getItem(this.tutorialStorageKey);
        if (!hasSeenTutorial) {
            // 首次启动，显示教程
            setTimeout(() => this.showTutorial(), 500);
        }
    }

    // 设置调试模式
    setupDebugMode() {
        this.debugPanel = document.getElementById('debug-panel');

        // 从 localStorage 恢复调试模式状态
        const savedDebugMode = localStorage.getItem(this.debugStorageKey);
        if (savedDebugMode === 'true') {
            this.debugMode = true;
            this.debugPanel.classList.remove('hidden');
        }
    }

    // 切换调试模式
    toggleDebugMode() {
        this.debugMode = !this.debugMode;

        if (this.debugPanel) {
            if (this.debugMode) {
                this.debugPanel.classList.remove('hidden');
            } else {
                this.debugPanel.classList.add('hidden');
            }
        }

        // 保存调试模式状态
        localStorage.setItem(this.debugStorageKey, this.debugMode.toString());

        console.log(`调试模式: ${this.debugMode ? '开启' : '关闭'}`);
    }

    // 显示教程
    showTutorial() {
        if (this.tutorialScreen) {
            this.tutorialScreen.classList.remove('hidden');
            this.tutorialShown = true;

            // 显示教程时自动暂停游戏
            if (this.gameState === 'playing') {
                this.pause();
            }
        }
    }

    // 关闭教程
    closeTutorial() {
        if (this.tutorialScreen) {
            this.tutorialScreen.classList.add('hidden');
            this.tutorialShown = false;

            // 标记已看过教程
            localStorage.setItem(this.tutorialStorageKey, 'true');

            // 关闭教程后恢复游戏
            if (this.gameState === 'paused') {
                this.pause(); // 再次调用以恢复
            }
        }
    }

    // 切换教程显示状态
    toggleTutorial() {
        if (this.tutorialShown) {
            this.closeTutorial();
        } else {
            this.showTutorial();
        }
    }
    
    // 重新开始游戏
    restartGame() {
        // 重置游戏状态
        this.gameState = 'playing';
        this.winner = null;
        this.lastTime = 0;

        // 重置玩家状态 - 使用完整的reset方法
        this.players.forEach(player => player.reset());

        // 重置UI
        this.updateUI();

        // 隐藏游戏结束界面
        const gameOverScreen = document.getElementById('game-over-screen');
        if (gameOverScreen) {
            gameOverScreen.classList.add('hidden');
        }

        // 显示教程
        setTimeout(() => this.showTutorial(), 300);

        // 重新启动游戏循环
        if (!this.isRunning) {
            this.start();
        }

        console.log('游戏已重新开始！');
    }
    
    // 暂停/恢复游戏
    pause() {
        const wasPlaying = this.gameState === 'playing';
        this.gameState = this.gameState === 'playing' ? 'paused' : 'playing';

        // 更新暂停按钮状态
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            if (this.gameState === 'paused') {
                pauseBtn.textContent = '恢复';
                pauseBtn.classList.add('paused');
            } else {
                pauseBtn.textContent = '暂停';
                pauseBtn.classList.remove('paused');
            }
        }

        // 暂停时显示教程
        if (this.gameState === 'paused' && !this.tutorialShown) {
            setTimeout(() => this.showTutorial(), 300);
        }

        console.log(`游戏状态: ${this.gameState}`);
    }
}

// 创建游戏实例
let game;

window.addEventListener('load', function() {
    game = new Game();
    // 导出到全局作用域，以便其他脚本可以访问游戏实例
    window.game = game;
});

// 导出到全局作用域，以便其他脚本使用
window.Game = Game;