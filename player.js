// 特效对象池系统
class EffectPool {
    constructor() {
        this.pools = {
            attack: [],
            hit: [],
            combo: [],
            heal: []
        };
        this.maxPoolSize = 20; // 每种类型最多缓存20个对象
    }

    // 获取特效对象
    getEffect(type) {
        const pool = this.pools[type];
        if (pool.length > 0) {
            return pool.pop();
        }
        return this.createEffect(type);
    }

    // 释放特效对象
    releaseEffect(effect) {
        if (!effect || !effect.type) return;
        const pool = this.pools[effect.type];
        if (pool && pool.length < this.maxPoolSize) {
            // 重置对象状态
            effect.startTime = 0;
            pool.push(effect);
        }
    }

    createEffect(type) {
        // 创建新对象
        return { type, startTime: 0 };
    }

    // 清空所有对象池
    clear() {
        Object.keys(this.pools).forEach(key => {
            this.pools[key] = [];
        });
    }
}

class Player {
    constructor(playerId, x, y, color) {
        this.playerId = playerId;
        this.initialX = x;
        this.initialY = y;
        this.x = x;
        this.y = y;
        this.width = 60;
        this.height = 120;
        this.color = color;

        // 角色属性
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.maxStamina = 100;
        this.stamina = this.maxStamina;
        this.speed = 5;
        this.jumpPower = 15;
        this.isOnGround = true;
        this.velocity = { x: 0, y: 0 };

        // 角色状态
        this.state = 'idle'; // idle, walking, jumping, attacking, defending, hit
        this.facing = playerId === 1 ? 'right' : 'left';
        this.isAttacking = false;
        this.isDefending = false;
        this.isHit = false;
        this.comboCount = 0;
        this.lastAttackTime = 0;

        // 特效对象池（全局共享）
        if (!window.globalEffectPool) {
            window.globalEffectPool = new EffectPool();
        }
        this.effectPool = window.globalEffectPool;

        // 攻击相关
        this.attackRange = 80;
        this.attackDamage = {
            punch: 10,
            kick: 15
        };
        this.attackDuration = {
            punch: 200,
            kick: 300
        };

        // 防御相关
        this.defenseReduction = 0.5; // 减少50%伤害

        // 击退相关
        this.knockbackConfig = {
            baseVelocity: 6,           // 原始击退速度
            punchMultiplier: 0.25,     // 拳攻击倍数
            kickMultiplier: 0.4,      // 腿攻击倍数
            defenseDistance: 7,        // 防御状态固定距离（厘米）
            pixelsPerCm: 60           // 像素与厘米的转换比例
        };

        // 动画相关
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 8;

        // 特效
        this.effects = [];

        // 气力系统配置
        this.staminaConfig = {
            movement: {
                left: +5,     // 每秒恢复
                right: +5,    // 每秒恢复
                jump: +3      // 跳跃奖励
            },
            actions: {
                punch: -5,
                kick: -15,
                defend: -10  // 每秒消耗
            },
            recovery: {
                idle: +10,   // 每秒恢复
                movement: +5, // 移动恢复
                rate: 1000   // 恢复间隔(毫秒)
            }
        };

        // 气力恢复系统
        this.staminaRecovery = {
            isResting: false,
            restStartTime: 0,
            lastRecoveryTime: 0,
            lastMovementRecoveryTime: 0,
            isMoving: false,
            movementStartTime: 0,
            defenseTimer: null
        };

        // 输入状态
        this.input = {
            left: false,
            right: false,
            jump: false,
            punch: false,
            kick: false,
            defend: false
        };

        // 新输入状态引用
        this.inputState = null;

        // 连招系统
        this.comboSystem = {
            // 连招输入序列
            inputSequence: [],
            // 输入时间窗口（毫秒）
            inputWindow: 3500,
            // 最后输入时间
            lastInputTime: 0,
            // 连招冷却时间
            cooldowns: {},
            // 当前激活的连招效果
            activeEffects: []
        };

        // 当前触发的连招（等待攻击命中时完成）
        this.currentCombo = null;

        // 连招配置
        this.comboConfig = {
            'windStrike': {
                name: '疾风连击',
                sequence: ['punch', 'punch', 'kick'],
                damage: 12,  // 额外伤害
                staminaCost: 37.5,
                cooldown: 5000,
                knockbackMultiplier: 1.3,
                type: 'offensive',
                color: '#3498db'
            },
            'thunderStrike': {
                name: '雷霆重击',
                sequence: ['kick', 'kick', 'punch'],
                damage: 15,  // 额外伤害
                staminaCost: 52.5,
                cooldown: 5000,  // 5秒
                knockbackMultiplier: 1.5,
                type: 'offensive',
                color: '#FFD700'
            },
            'healingStrike': {
                name: '气功疗伤',
                sequence: ['jump', 'punch'],  // 跳拳
                damage: -20,  // 负数表示治疗
                staminaCost: 20,
                cooldown: 4500,
                knockbackMultiplier: 0,
                type: 'healing',
                color: '#2ecc71',
                requireJump: true  // 需要在跳跃中触发
            }
        };

        // 连招哈希表优化：预构建序列到ID的映射
        this.comboMap = new Map();
        Object.entries(this.comboConfig).forEach(([id, combo]) => {
            const key = combo.sequence.join(',');
            this.comboMap.set(key, id);
        });
    }
    
    setInputState(inputState) {
        this.inputState = inputState;
    }
    
    update(gameWidth, gameHeight) {
        this.handleInput();
        this.updatePosition(gameWidth, gameHeight);
        this.updateState();
        this.updateAnimation();
        this.updateEffects();
        this.checkBoundaries(gameWidth, gameHeight);
        
        // 气力系统更新 - 即时更新，确保UI流畅
        this.checkRestingState();
        this.updateStaminaRecovery();
    }
    
    handleInput() {
        // 优先使用新的输入系统
        let input = this.input;
        if (this.inputState) {
            input = this.inputState.processedInput;
        }
        
        // 水平移动（受击状态下移动被中断）
        if (input.left && !this.isAttacking && !this.isHit) {
            this.velocity.x = -this.speed;
            this.facing = 'left';
            if (this.isOnGround) {
                this.state = 'walking';
            }
            this.startMovementRecovery();
        } else if (input.right && !this.isAttacking && !this.isHit) {
            this.velocity.x = this.speed;
            this.facing = 'right';
            if (this.isOnGround) {
                this.state = 'walking';
            }
            this.startMovementRecovery();
        } else if (!this.isHit) {
            this.velocity.x *= 0.8; // 摩擦力
            this.stopMovementRecovery();
            if (this.isOnGround && !this.isAttacking) {
                this.state = 'idle';
            }
        }
        
        // 跳跃（不允许在受击状态下跳跃）
        if (input.jump && this.isOnGround && !this.isAttacking && !this.isHit) {
            this.velocity.y = -this.jumpPower;
            this.isOnGround = false;
            this.state = 'jumping';
            this.addStamina(this.staminaConfig.movement.jump); // 跳跃奖励
            // 记录跳跃输入用于连招
            this.recordComboInput('jump');
        }
        
        // 防御（不允许在受击状态下防御）
        if (input.defend && !this.isAttacking && !this.isHit && this.stamina > 0) {
            this.isDefending = true;
            this.state = 'defending';
        } else {
            this.isDefending = false;
        }
        
        // 攻击（不允许在受击状态下攻击）
        if ((input.punch || input.kick) && !this.isAttacking && !this.isHit) {
            this.performAttack(input.punch, input.kick);
        }
    }
    
    performAttack(isPunch, isKick) {
        const now = Date.now();
        if (now - this.lastAttackTime < 100) return; // 防止连击过快

        // 记录连招输入
        const action = isPunch ? 'punch' : 'kick';
        this.recordComboInput(action);

        // 检查是否触发连招
        const triggeredCombo = this.checkComboTrigger();
        if (triggeredCombo) {
            const combo = this.comboConfig[triggeredCombo];

            // 治疗型连招立即完成，不需要等待命中
            if (combo.type === 'healing') {
                // 消耗气力
                this.consumeStamina(-combo.staminaCost);

                // 设置冷却时间
                this.comboSystem.cooldowns[triggeredCombo] = Date.now() + combo.cooldown;

                // 清空输入序列
                this.comboSystem.inputSequence = [];

                console.log(`玩家${this.playerId} 触发连招: ${combo.name}`);

                // 恢复生命值
                this.health = Math.min(this.maxHealth, this.health - combo.damage); // damage为负数
                this.addHealEffect(-combo.damage);

                // 添加连招特效
                this.addComboEffect(combo);

                // 治疗型连招不执行攻击动作，直接返回
                return;
            }

            // 进攻型连招：标记当前连招，等待攻击命中时完成
            this.currentCombo = {
                id: triggeredCombo,
                combo: combo,
                attackType: action
            };
        }

        // 检查气力是否足够
        const staminaCost = isPunch ?
            Math.abs(this.staminaConfig.actions.punch) :
            Math.abs(this.staminaConfig.actions.kick);

        if (!this.hasEnoughStamina(staminaCost)) {
            return; // 气力不足，无法攻击
        }

        this.isAttacking = true;
        this.lastAttackTime = now;
        this.comboCount++;

        // 消耗气力
        if (isPunch) {
            this.consumeStamina(this.staminaConfig.actions.punch);
            this.state = 'attacking_punch';
            setTimeout(() => {
                this.isAttacking = false;
                if (!this.currentCombo) {
                    this.state = this.isOnGround ? 'idle' : 'jumping';
                }
            }, this.attackDuration.punch);
        } else if (isKick) {
            this.consumeStamina(this.staminaConfig.actions.kick);
            this.state = 'attacking_kick';
            setTimeout(() => {
                this.isAttacking = false;
                if (!this.currentCombo) {
                    this.state = this.isOnGround ? 'idle' : 'jumping';
                }
            }, this.attackDuration.kick);
        }

        // 添加攻击特效
        this.addAttackEffect();
    }

    // 记录连招输入
    recordComboInput(action) {
        const now = Date.now();

        // 检查是否超时
        if (now - this.comboSystem.lastInputTime > this.comboSystem.inputWindow) {
            // 超时，清空序列
            this.comboSystem.inputSequence = [];
        }

        // 添加输入
        this.comboSystem.inputSequence.push(action);
        this.comboSystem.lastInputTime = now;

        // 限制序列长度为3（当前最大连招长度）
        if (this.comboSystem.inputSequence.length > 3) {
            this.comboSystem.inputSequence.shift();
        }
    }

    // 检查是否触发连招
    checkComboTrigger() {
        const sequence = this.comboSystem.inputSequence;

        // 使用哈希表优化：O(1)时间复杂度查找
        const key = sequence.join(',');
        const comboId = this.comboMap.get(key);

        if (!comboId) return null;

        const combo = this.comboConfig[comboId];

        // 检查冷却时间
        if (this.isComboOnCooldown(comboId)) return null;

        // 检查气力是否足够
        if (!this.hasEnoughStamina(combo.staminaCost)) return null;

        // 检查是否需要跳跃状态
        if (combo.requireJump && !this.isOnGround) {
            return comboId;
        } else if (!combo.requireJump) {
            return comboId;
        }

        return null;
    }

    // 检查连招是否在冷却中
    isComboOnCooldown(comboId) {
        const cooldownEnd = this.comboSystem.cooldowns[comboId];
        if (!cooldownEnd) return false;
        return Date.now() < cooldownEnd;
    }

    // 完成连招（在攻击命中时调用）
    completeCombo() {
        if (!this.currentCombo) return;

        const combo = this.currentCombo.combo;

        // 消耗气力
        this.consumeStamina(-combo.staminaCost);

        // 设置冷却时间
        this.comboSystem.cooldowns[this.currentCombo.id] = Date.now() + combo.cooldown;

        // 清空输入序列
        this.comboSystem.inputSequence = [];

        console.log(`玩家${this.playerId} 完成连招: ${combo.name}`);

        // 根据连招类型执行不同效果
        if (combo.type === 'offensive') {
            // 进攻型连招：返回额外伤害供碰撞检测使用
            this.comboSystem.activeEffects.push({
                type: 'damage',
                value: combo.damage,  // 额外伤害
                knockbackMultiplier: combo.knockbackMultiplier,
                comboName: combo.name,
                color: combo.color
            });
        } else if (combo.type === 'healing') {
            // 治疗型连招
            this.health = Math.min(this.maxHealth, this.health - combo.damage); // damage为负数
            this.addHealEffect(-combo.damage);
        }

        // 添加连招特效
        this.addComboEffect(combo);

        // 清除当前连招标记
        this.currentCombo = null;

        // 恢复状态
        this.state = this.isOnGround ? 'idle' : 'jumping';
    }

    // 执行治疗型连招（跳跃时触发）
    executeHealingCombo(combo) {
        // 恢复生命值
        this.health = Math.min(this.maxHealth, this.health - combo.damage); // damage为负数

        // 添加治疗特效
        this.addHealEffect(-combo.damage);
    }

    // 添加连招特效
    addComboEffect(combo) {
        const effect = this.effectPool.getEffect('combo');
        effect.comboName = combo.name;
        effect.x = this.x + this.width / 2;
        effect.y = this.y + this.height / 2;
        effect.radius = 50;
        effect.duration = 500;
        effect.startTime = Date.now();
        effect.color = combo.color;
        this.effects.push(effect);
    }

    // 添加治疗特效
    addHealEffect(amount) {
        const effect = this.effectPool.getEffect('heal');
        effect.x = this.x + this.width / 2;
        effect.y = this.y + this.height / 2;
        effect.radius = 30;
        effect.duration = 400;
        effect.startTime = Date.now();
        effect.color = '#2ecc71';
        effect.amount = amount;
        this.effects.push(effect);
    }

    // 数组比较辅助函数
    arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
    
    addAttackEffect() {
        const effect = this.effectPool.getEffect('attack');
        effect.x = this.facing === 'right' ? this.x + this.width : this.x - 40;
        effect.y = this.y + this.height / 2;
        effect.width = 40;
        effect.height = 20;
        effect.duration = 150;
        effect.startTime = Date.now();
        effect.color = this.state.includes('punch') ? '#ff6b6b' : '#4ecdc4';
        this.effects.push(effect);
    }
    
    updatePosition(gameWidth, gameHeight) {
        // 重力
        if (!this.isOnGround) {
            this.velocity.y += 0.8; // 重力加速度
        }
        
        // 更新位置
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        
        // 地面碰撞
        const groundLevel = gameHeight - 100; // 留出底部UI空间
        if (this.y + this.height >= groundLevel) {
            this.y = groundLevel - this.height;
            this.velocity.y = 0;
            this.isOnGround = true;
            
            // 根据角色状态设置新状态
            if (this.state === 'jumping' || this.state === 'hit') {
                if (this.velocity.x !== 0) {
                    this.state = 'walking';
                } else {
                    this.state = 'idle';
                }
            }
        } else {
            this.isOnGround = false;
        }
    }
    
    updateState() {
        if (this.isHit) {
            this.state = 'hit';
        }
    }
    
    updateAnimation() {
        this.animationTimer++;
        if (this.animationTimer >= this.animationSpeed) {
            this.animationFrame = (this.animationFrame + 1) % 4;
            this.animationTimer = 0;
        }
    }
    
    updateEffects() {
        const now = Date.now();
        const activeEffects = [];
        const expiredEffects = [];

        // 分离活跃和过期的特效
        this.effects.forEach(effect => {
            if (now - effect.startTime < effect.duration) {
                activeEffects.push(effect);
            } else {
                expiredEffects.push(effect);
            }
        });

        // 将过期的特效释放回对象池
        expiredEffects.forEach(effect => {
            this.effectPool.releaseEffect(effect);
        });

        // 更新特效列表
        this.effects = activeEffects;
    }
    
    checkBoundaries(gameWidth, gameHeight) {
        // 左右边界
        if (this.x < 0) {
            this.x = 0;
            this.velocity.x = 0;
        }
        if (this.x + this.width > gameWidth) {
            this.x = gameWidth - this.width;
            this.velocity.x = 0;
        }
        
        // 顶部边界 - 受击状态时允许向上移动但不卡住
        if (this.y < 0) {
            if (this.isHit) {
                // 受击状态时，让角色能继续向上移动
                this.y = 0;
                // 不重置velocity.y，让重力继续作用
            } else {
                // 正常状态时阻止向上移动
                this.y = 0;
                this.velocity.y = 0;
            }
        }
        
        // 底部边界处理在 updatePosition 中处理
    }
    
    // 计算击退距离和速度
    calculateKnockback(attacker, attackType) {
        let knockbackVelocity;
        
        // 如果目标处于防御状态，使用固定距离
        if (this.isDefending) {
            const defenseDistancePixels = this.knockbackConfig.defenseDistance * this.knockbackConfig.pixelsPerCm;
            knockbackVelocity = defenseDistancePixels / 10; // 转换为速度
        } else {
            // 根据攻击类型选择击退倍数
            let multiplier;
            if (attackType === 'punch') {
                multiplier = this.knockbackConfig.punchMultiplier;
            } else if (attackType === 'kick') {
                multiplier = this.knockbackConfig.kickMultiplier;
            } else {
                multiplier = 1; // 默认倍数
            }
            
            knockbackVelocity = this.knockbackConfig.baseVelocity * multiplier;
        }
        
        const knockbackDirection = attacker.x > this.x ? -1 : 1;
        return knockbackDirection * knockbackVelocity;
    }
    
    takeDamage(damage, attacker, attackType = 'unknown') {
        // 基础防御
        if (this.isDefending) {
            damage *= this.defenseReduction;
        }

        this.health -= damage;
        this.health = Math.max(0, this.health);

        // 受击效果
        this.isHit = true;

        // 立即清除移动速度，确保击退效果完全生效
        this.velocity.x = 0;

        // 计算并应用击退速度
        this.velocity.x = this.calculateKnockback(attacker, attackType);

        // 类似跳跃的击退逻辑
        if (this.isOnGround) {
            // 如果在地面上，给予向上的击退
            this.velocity.y = -12;
            this.isOnGround = false;
            this.state = 'hit';
        } else {
            // 如果在空中，减少水平击退
            this.velocity.y = Math.min(this.velocity.y, -3);
        }

        // 设置受击状态持续时间
        setTimeout(() => {
            this.isHit = false;
            if (this.isOnGround) {
                this.state = 'idle';
            }
        }, 500);

        // 添加受击特效
        this.addHitEffect();

        // 检查是否被击败
        if (this.health <= 0) {
            this.state = 'defeated';
        }
    }
    
    addHitEffect() {
        const effect = this.effectPool.getEffect('hit');
        effect.x = this.x + this.width / 2;
        effect.y = this.y + this.height / 2;
        effect.radius = 20;
        effect.duration = 200;
        effect.startTime = Date.now();
        effect.color = '#ff0000';
        this.effects.push(effect);
    }
    
    // 检测与另一个玩家的碰撞
    checkCollision(otherPlayer) {
        return this.x < otherPlayer.x + otherPlayer.width &&
               this.x + this.width > otherPlayer.x &&
               this.y < otherPlayer.y + otherPlayer.height &&
               this.y + this.height > otherPlayer.y;
    }
    
    // 检测攻击命中
    checkAttackHit(otherPlayer) {
        if (!this.isAttacking) return false;
        
        const attackX = this.facing === 'right' ? this.x + this.width : this.x - this.attackRange;
        const attackY = this.y + 20;
        const attackWidth = this.attackRange;
        const attackHeight = this.height - 40;
        
        return attackX < otherPlayer.x + otherPlayer.width &&
               attackX + attackWidth > otherPlayer.x &&
               attackY < otherPlayer.y + otherPlayer.height &&
               attackY + attackHeight > otherPlayer.y;
    }
    
    // 重置角色状态
    reset() {
        this.health = this.maxHealth;
        this.stamina = this.maxStamina;
        this.velocity = { x: 0, y: 0 };
        this.state = 'idle';
        this.isAttacking = false;
        this.isDefending = false;
        this.isHit = false;
        this.comboCount = 0;
        this.effects = [];
        this.isOnGround = true;
        this.x = this.initialX;
        this.y = this.initialY;
        this.facing = this.playerId === 1 ? 'right' : 'left';

        // 重置气力恢复系统
        this.staminaRecovery = {
            isResting: false,
            restStartTime: 0,
            lastRecoveryTime: 0,
            lastMovementRecoveryTime: 0,
            isMoving: false,
            movementStartTime: 0,
            defenseTimer: null
        };

        // 重置连招系统
        this.comboSystem = {
            inputSequence: [],
            inputWindow: 3500,
            lastInputTime: 0,
            cooldowns: {},
            activeEffects: []
        };

        // 重置当前连招
        this.currentCombo = null;
    }
    
    // 渲染角色
    render(ctx) {
        // 保存上下文
        ctx.save();
        
        // 移动到角色位置
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        
        // 水平翻转（面向方向）
        if (this.facing === 'left') {
            ctx.scale(-1, 1);
        }
        
        // 根据状态设置颜色和效果
        let renderColor = this.color;
        if (this.isHit) {
            renderColor = '#ff4444';
        } else if (this.isDefending) {
            renderColor = '#4444ff';
        } else if (this.isAttacking) {
            renderColor = '#ffff44';
        }
        
        // 绘制角色身体
        ctx.fillStyle = renderColor;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        
        // 绘制头部
        ctx.fillStyle = '#ffdbac';
        ctx.fillRect(-20, -this.height / 2 - 30, 40, 30);
        
        // 绘制眼睛
        ctx.fillStyle = '#000';
        ctx.fillRect(-10, -this.height / 2 - 20, 6, 6);
        ctx.fillRect(4, -this.height / 2 - 20, 6, 6);
        
        // 绘制动作特效
        if (this.isAttacking) {
            ctx.fillStyle = '#ffff00';
            if (this.state.includes('punch')) {
                ctx.fillRect(this.width / 2, -10, 20, 20);
            } else {
                ctx.fillRect(this.width / 2, 10, 30, 10);
            }
        }
        
        // 恢复上下文
        ctx.restore();
        
        // 渲染特效
        this.renderEffects(ctx);
    }
    
    renderEffects(ctx) {
        const now = Date.now();

        this.effects.forEach(effect => {
            const elapsed = now - effect.startTime;
            const progress = elapsed / effect.duration;

            ctx.save();

            if (effect.type === 'attack') {
                ctx.globalAlpha = 1 - progress;
                ctx.fillStyle = effect.color;
                ctx.fillRect(effect.x, effect.y, effect.width, effect.height);
            } else if (effect.type === 'hit') {
                ctx.globalAlpha = 1 - progress;
                ctx.strokeStyle = effect.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, effect.radius * (1 + progress), 0, Math.PI * 2);
                ctx.stroke();
            } else if (effect.type === 'combo') {
                ctx.globalAlpha = 1 - progress;
                ctx.strokeStyle = effect.color;
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, effect.radius * (0.5 + progress), 0, Math.PI * 2);
                ctx.stroke();

                // 显示连招名称
                ctx.fillStyle = effect.color;
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(effect.comboName, effect.x, effect.y - effect.radius - 10);
            } else if (effect.type === 'heal') {
                ctx.globalAlpha = 1 - progress;
                ctx.strokeStyle = effect.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, effect.radius * (0.5 + progress), 0, Math.PI * 2);
                ctx.stroke();

                // 显示治疗数值
                ctx.fillStyle = effect.color;
                ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`+${effect.amount}`, effect.x, effect.y);
            }

            ctx.restore();
        });
    }
    
    // 气力系统方法
    consumeStamina(amount) {
        this.stamina = Math.max(0, Math.min(this.maxStamina, this.stamina + amount));
        return this.stamina > 0 || amount >= 0; // 返回是否消耗成功
    }
    
    addStamina(amount) {
        this.stamina = Math.max(0, Math.min(this.maxStamina, this.stamina + amount));
        return this.stamina < this.maxStamina; // 返回是否还能继续增加
    }
    
    hasEnoughStamina(requiredAmount) {
        return this.stamina >= requiredAmount;
    }
    
    startStaminaRecovery() {
        if (!this.staminaRecovery.isResting) {
            this.staminaRecovery.isResting = true;
            this.staminaRecovery.restStartTime = Date.now();
            this.staminaRecovery.lastRecoveryTime = Date.now();
        }
    }
    
    stopStaminaRecovery() {
        this.staminaRecovery.isResting = false;
    }
    
    startMovementRecovery() {
        if (!this.staminaRecovery.isMoving) {
            this.staminaRecovery.isMoving = true;
            this.staminaRecovery.movementStartTime = Date.now();
            this.staminaRecovery.lastMovementRecoveryTime = Date.now();
        }
    }
    
    stopMovementRecovery() {
        this.staminaRecovery.isMoving = false;
    }
    
    updateStaminaRecovery() {
        const now = Date.now();
        
        // 移动恢复 - 即时处理
        if (this.staminaRecovery.isMoving && this.stamina < this.maxStamina) {
            if (now - this.staminaRecovery.lastMovementRecoveryTime >= this.staminaConfig.recovery.rate) {
                this.consumeStamina(this.staminaConfig.recovery.movement);
                this.staminaRecovery.lastMovementRecoveryTime = now;
            }
        }
        
        // 静置恢复 - 即时处理
        if (this.staminaRecovery.isResting && this.stamina < this.maxStamina) {
            if (now - this.staminaRecovery.lastRecoveryTime >= this.staminaConfig.recovery.rate) {
                this.consumeStamina(this.staminaConfig.recovery.idle);
                this.staminaRecovery.lastRecoveryTime = now;
            }
        }
        
        // 防御持续消耗 - 即时处理
        if (this.isDefending && this.stamina > 0) {
            if (!this.staminaRecovery.defenseTimer) {
                this.staminaRecovery.defenseTimer = now;
            }
            
            if (now - this.staminaRecovery.defenseTimer >= 1000) { // 每秒消耗
                if (!this.consumeStamina(this.staminaConfig.actions.defend)) {
                    this.isDefending = false; // 气力耗尽，自动解除防御
                    this.state = 'idle';
                }
                this.staminaRecovery.defenseTimer = now;
            }
        } else {
            this.staminaRecovery.defenseTimer = null;
        }
    }
    
    checkRestingState() {
        const isIdle = this.state === 'idle';
        const noInput = !Object.values(this.input).some(v => v) && 
                       (!this.inputState || !Object.values(this.inputState.processedInput).some(v => v));
        
        // 只有在真正静置时才启动静置恢复
        if (isIdle && noInput && !this.staminaRecovery.isMoving) {
            this.startStaminaRecovery();
        } else {
            this.stopStaminaRecovery();
        }
    }
}