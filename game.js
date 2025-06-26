class MatarikiGame {
    constructor() {
        this.canvas = document.getElementById('starCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.stars = [];
        this.connections = [];
        this.discoveredStars = new Set();
        this.twinkleOffset = 0;
        this.animationFrameId = null;
        
        // New sequential game logic
        this.starSequence = ['waitii', 'waita', 'waipuna-a-rangi', 'tupuanuku', 'tupuarangi', 'ururangi', 'pohutukawa', 'hiwa-i-te-rangi', 'matariki'];
        this.currentStarIndex = 0;
        this.gameCompleted = false;
        
        // Hint system
        this.hintFlashes = [];
        this.isShowingHint = false;
        
        // Celebration effects
        this.particles = [];
        this.isCelebrating = false;
        this.celebrationTime = 0;
        
        this.initializeGame();
        this.setupEventListeners();
        this.startGameLoop();
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }
    
    initializeGame() {
        this.loadStars();
        this.resizeCanvas();
        this.resetProgress();
    }
    
    loadStars() {
        this.stars = JSON.parse(JSON.stringify(MATARIKI_STARS));
        this.connections = [];
        this.discoveredStars.clear();
        this.currentStarIndex = 0;
        this.gameCompleted = false;
        
        // Reset star states
        this.stars.forEach(star => {
            star.discovered = false;
            star.isTarget = false;
            star.jiggling = false;
        });
        
        // Set first target star
        this.updateTargetStar();
    }
    
    resizeCanvas() {
        // Set canvas to full viewport size
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.calculateAvailableSpace();
        this.scaleStarPositions();
    }
    
    calculateAvailableSpace() {
        // Check if mobile
        const isMobile = window.innerWidth <= 768;
        
        // Calculate available space avoiding UI overlays
        const headerHeight = isMobile ? 90 : 120; // Header + margin
        const footerHeight = isMobile ? 60 : 80;  // Footer + margin
        
        if (isMobile) {
            // Mobile: panels are in document flow below canvas, stars use full canvas
            this.availableSpace = {
                left: 20,
                right: this.canvas.width - 20,
                top: headerHeight,
                bottom: this.canvas.height - footerHeight,
            };
        } else {
            // Desktop: panels are left and right
            const leftPanelWidth = 390; // Cultural panel width + margins
            const rightMargin = 320; // Star image container width + margins
            
            this.availableSpace = {
                left: leftPanelWidth,
                right: this.canvas.width - rightMargin,
                top: headerHeight,
                bottom: this.canvas.height - footerHeight,
            };
        }
        
        // Ensure minimum space
        if (isMobile) {
            // On mobile, ensure minimum vertical space for stars
            const minHeightRatio = 0.3;
            if (this.availableSpace.bottom - this.availableSpace.top < this.canvas.height * minHeightRatio) {
                this.availableSpace.top = this.canvas.height * 0.25;
                this.availableSpace.bottom = this.canvas.height * 0.75;
            }
        } else {
            // On desktop, ensure minimum horizontal space for stars
            const minWidthRatio = 0.3;
            if (this.availableSpace.right - this.availableSpace.left < this.canvas.width * minWidthRatio) {
                this.availableSpace.left = this.canvas.width * 0.35;
                this.availableSpace.right = this.canvas.width * 0.65;
            }
        }
    }
    
    scaleStarPositions() {
        // Calculate scaling to fit available space
        const availableWidth = this.availableSpace.right - this.availableSpace.left;
        const availableHeight = this.availableSpace.bottom - this.availableSpace.top;
        
        // Use smaller scaling factor to ensure stars fit comfortably
        const isMobile = window.innerWidth <= 768;
        const scaleFactor = isMobile ? 0.8 : 0.9; // Smaller scale on mobile for better spacing
        const scaleX = availableWidth / 800 * scaleFactor;
        const scaleY = availableHeight / 600 * scaleFactor;
        
        // Use uniform scaling to maintain constellation shape
        const scale = Math.min(scaleX, scaleY);
        
        // Center the constellation in available space
        const constellationWidth = 800 * scale;
        const constellationHeight = 600 * scale;
        const offsetX = this.availableSpace.left + (availableWidth - constellationWidth) / 2;
        const offsetY = this.availableSpace.top + (availableHeight - constellationHeight) / 2;
        
        this.stars.forEach(star => {
            star.scaledX = offsetX + star.x * scale;
            star.scaledY = offsetY + star.y * scale;
        });
    }
    
    setupEventListeners() {
        // Canvas interactions - simple click only
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchClick.bind(this));
        
        // UI interactions
        document.getElementById('resetBtn').addEventListener('click', this.resetGame.bind(this));
        document.getElementById('hintBtn').addEventListener('click', this.showHint.bind(this));
        
        // Resize handler
        window.addEventListener('resize', this.resizeCanvas.bind(this));
    }
    
    
    handleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const star = this.getStarAt(x, y);
        if (star) {
            this.handleStarClick(star);
        }
    }
    
    handleTouchClick(event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const touch = event.changedTouches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const star = this.getStarAt(x, y);
        if (star) {
            this.handleStarClick(star);
        }
    }
    
    handleStarClick(star) {
        if (this.gameCompleted) {
            // If game is completed, allow viewing any discovered star
            if (star.discovered) {
                this.showStarInfo(star);
            }
            return;
        }
        
        // Check if this is the correct star in sequence
        const targetStarId = this.starSequence[this.currentStarIndex];
        
        if (star.id === targetStarId) {
            // Correct star clicked
            this.discoverStar(star);
        } else {
            // Wrong star clicked - jiggle it
            this.jiggleStar(star);
        }
    }
    
    getStarAt(x, y) {
        const isMobile = window.innerWidth <= 768;
        const tolerance = isMobile ? 80 : 50; // Larger touch target on mobile
        
        // Find all stars within tolerance, then return the closest one
        let closestStar = null;
        let closestDistance = Infinity;
        
        for (let star of this.stars) {
            const distance = Math.sqrt(
                Math.pow(x - star.scaledX, 2) + Math.pow(y - star.scaledY, 2)
            );
            
            if (distance <= tolerance && distance < closestDistance) {
                closestDistance = distance;
                closestStar = star;
            }
        }
        
        return closestStar;
    }
    
    updateTargetStar() {
        // Clear previous target
        this.stars.forEach(star => star.isTarget = false);
        
        // Set current target star if game not completed
        if (this.currentStarIndex < this.starSequence.length) {
            const targetStarId = this.starSequence[this.currentStarIndex];
            const targetStar = this.stars.find(star => star.id === targetStarId);
            if (targetStar) {
                targetStar.isTarget = true;
            }
        }
        
        this.updateObjectiveDisplay();
    }
    
    updateObjectiveDisplay() {
        const nextStarTitle = document.getElementById('nextStarTitle');
        
        if (nextStarTitle) {
            if (this.gameCompleted) {
                nextStarTitle.textContent = "All Stars Found!";
            } else if (this.currentStarIndex < this.starSequence.length) {
                const targetStarId = this.starSequence[this.currentStarIndex];
                const targetStar = this.stars.find(star => star.id === targetStarId);
                nextStarTitle.innerHTML = `Current objective:<br><span class="find-text">Find ${targetStar ? targetStar.name : 'Unknown Star'}</span>`;
            }
        }
    }
    
    discoverStar(star) {
        star.discovered = true;
        star.isTarget = false;
        this.discoveredStars.add(star.id);
        this.showStarInfo(star);
        
        // Add connection to previous star if not the first star
        if (this.currentStarIndex > 0) {
            const previousStarId = this.starSequence[this.currentStarIndex - 1];
            const previousStar = this.stars.find(s => s.id === previousStarId);
            if (previousStar) {
                this.connections.push({ star1: previousStar, star2: star });
            }
        }
        
        // Move to next star
        this.currentStarIndex++;
        this.updateProgress();
        
        if (this.currentStarIndex >= this.starSequence.length) {
            // Game completed
            this.gameCompleted = true;
            setTimeout(() => this.showCompletion(), 1000);
        } else {
            // Set next target
            this.updateTargetStar();
        }
    }
    
    jiggleStar(star) {
        star.jiggling = true;
        setTimeout(() => {
            star.jiggling = false;
        }, 500);
    }
    
    showHint() {
        if (this.gameCompleted || this.isShowingHint) return;
        
        const targetStarId = this.starSequence[this.currentStarIndex];
        const targetStar = this.stars.find(star => star.id === targetStarId);
        
        if (!targetStar) return;
        
        this.isShowingHint = true;
        
        // Create hint flash in general area around the star
        const flashRadius = 150; // Large area around the star
        const flashDuration = 800; // Single flash lasts 800ms
        
        // Disable hint button temporarily
        const hintBtn = document.getElementById('hintBtn');
        hintBtn.disabled = true;
        
        // Add single flash effect
        this.hintFlashes.push({
            x: targetStar.scaledX,
            y: targetStar.scaledY,
            radius: flashRadius,
            color: targetStar.color,
            opacity: 1,
            fadeSpeed: 0.03,
            active: true
        });
        
        // Re-enable hint button and reset hint state after flash
        setTimeout(() => {
            this.isShowingHint = false;
            hintBtn.disabled = false;
        }, flashDuration);
    }
    
    getCurrentObjective() {
        if (this.gameCompleted) {
            return "Congratulations! All stars discovered!";
        }
        
        if (this.currentStarIndex < this.starSequence.length) {
            const targetStarId = this.starSequence[this.currentStarIndex];
            const targetStar = this.stars.find(star => star.id === targetStarId);
            return `Find: ${targetStar ? targetStar.name : 'Unknown Star'}`;
        }
        
        return "Game Complete";
    }
    
    showStarInfo(star) {
        const starInfo = document.getElementById('starInfo');
        const starName = document.getElementById('starName');
        const starMeaning = document.getElementById('starMeaning');
        const starStory = document.getElementById('starStory');
        const starCultural = document.getElementById('starCultural');
        const starImageContent = document.getElementById('starImageContent');
        const starImageContainer = document.getElementById('starImageContainer');
        const starImage = document.getElementById('starImage');
        
        starName.textContent = star.name;
        starName.style.color = star.color;
        starMeaning.textContent = star.meaning;
        starStory.innerHTML = `<h4>Traditional Story</h4><p>${star.story}</p>`;
        starCultural.innerHTML = `<h4>Cultural Significance</h4><p>${star.cultural}</p>`;
        
        // Show story and cultural containers
        starStory.classList.remove('hidden');
        starCultural.classList.remove('hidden');
        
        // Show the star image
        if (star.image) {
            starImage.src = star.image;
            starImage.alt = `${star.name} - ${star.meaning}`;
            starImageContent.classList.remove('hidden');
            starImageContainer.classList.remove('no-star-selected');
        }
        
        starInfo.classList.remove('hidden');
        document.getElementById('instructions').classList.add('hidden');
        
        // Store current star for reference
        this.currentStar = star;
        
        // Recalculate star positions to avoid star image overlay
        this.recalculateStarPositions();
    }
    
    hideStarInfo() {
        document.getElementById('starInfo').classList.add('hidden');
        document.getElementById('starImageContent').classList.add('hidden');
        document.getElementById('starImageContainer').classList.add('no-star-selected');
        document.getElementById('instructions').classList.remove('hidden');
        
        // Hide story and cultural containers
        document.getElementById('starStory').classList.add('hidden');
        document.getElementById('starCultural').classList.add('hidden');
        
        // Recalculate star positions without star image overlay
        this.recalculateStarPositions();
    }
    
    recalculateStarPositions() {
        // Recalculate and redraw
        this.calculateAvailableSpace();
        this.scaleStarPositions();
    }
    
    
    updateProgress() {
        const totalStars = this.stars.length;
        const discoveredStars = this.discoveredStars.size;
        const percentage = (discoveredStars / totalStars) * 100;
        
        document.getElementById('progressFill').style.width = percentage + '%';
        document.getElementById('progressText').textContent = 
            `${discoveredStars}/${totalStars} stars discovered`;
    }
    
    resetProgress() {
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressText').textContent = 
            `0/${this.stars.length} stars discovered`;
    }
    
    checkCompletion() {
        // Completion is now handled in discoverStar method
        return this.gameCompleted;
    }
    
    showCompletion() {
        document.getElementById('completionPanel').classList.remove('hidden');
        document.getElementById('starInfo').classList.add('hidden');
        
        // Automatically trigger celebration
        this.handleCelebration();
    }
    
    hideCompletion() {
        document.getElementById('completionPanel').classList.add('hidden');
    }
    
    handleCelebration() {
        // Start continuous celebration
        this.isCelebrating = true;
        this.celebrationTime = 0;
        
        // Trigger star celebration
        this.stars.forEach(star => {
            star.celebrating = true;
        });
        
        // Create initial burst of particles
        this.createParticleBurst();
    }
    
    createParticleBurst() {
        // Create particles from each star
        this.stars.forEach(star => {
            for (let i = 0; i < 15; i++) {
                this.particles.push({
                    x: star.scaledX,
                    y: star.scaledY,
                    vx: (Math.random() - 0.5) * 4,
                    vy: (Math.random() - 0.5) * 4,
                    life: 1,
                    decay: 0.01 + Math.random() * 0.02,
                    size: 2 + Math.random() * 3,
                    color: star.color,
                    sparkle: Math.random() * Math.PI * 2
                });
            }
        });
    }
    
    createContinuousParticles() {
        // Continuously create particles during celebration
        if (Math.random() < 0.3) {
            this.stars.forEach(star => {
                if (Math.random() < 0.1) {
                    this.particles.push({
                        x: star.scaledX + (Math.random() - 0.5) * 20,
                        y: star.scaledY + (Math.random() - 0.5) * 20,
                        vx: (Math.random() - 0.5) * 2,
                        vy: -Math.random() * 2 - 1,
                        life: 1,
                        decay: 0.015,
                        size: 1 + Math.random() * 2,
                        color: star.color,
                        sparkle: Math.random() * Math.PI * 2
                    });
                }
            });
        }
    }
    
    resetGame() {
        // Stop celebration
        this.isCelebrating = false;
        this.particles = [];
        this.celebrationTime = 0;
        
        this.initializeGame();
        this.hideStarInfo();
        this.hideCompletion();
        this.recalculateStarPositions();
    }
    
    startGameLoop() {
        const animate = () => {
            this.update();
            this.render();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    }
    
    update() {
        this.twinkleOffset += 0.02;
        
        // Update hint flashes
        this.hintFlashes = this.hintFlashes.filter(flash => {
            if (flash.active) {
                flash.opacity -= flash.fadeSpeed;
                if (flash.opacity <= 0) {
                    flash.active = false;
                    return false;
                }
            }
            return flash.active;
        });
        
        // Update celebration effects
        if (this.isCelebrating) {
            this.celebrationTime += 0.02;
            this.createContinuousParticles();
            
            // Create particle bursts periodically
            if (Math.floor(this.celebrationTime * 10) % 100 === 0) {
                this.createParticleBurst();
            }
        }
        
        // Update particles
        this.particles = this.particles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.1; // gravity
            particle.life -= particle.decay;
            particle.sparkle += 0.2;
            
            return particle.life > 0;
        });
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Add background color shift during celebration
        if (this.isCelebrating) {
            const colorShift = Math.sin(this.celebrationTime * 2) * 0.05 + 0.05;
            this.ctx.fillStyle = `rgba(60, 40, 80, ${colorShift})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Render background stars
        this.renderBackgroundStars();
        
        // Render constellation connections
        this.renderConnections();
        
        // Render hint flashes
        this.renderHintFlashes();
        
        // Render particles
        this.renderParticles();
        
        // Render Matariki stars
        this.renderMatarikiStars();
        
        // Render pulsing light rays during celebration
        if (this.isCelebrating) {
            this.renderLightRays();
        }
    }
    
    renderBackgroundStars() {
        const scaleX = this.canvas.width / 800;
        const scaleY = this.canvas.height / 600;
        
        BACKGROUND_STARS.forEach(star => {
            const x = star.x * scaleX;
            const y = star.y * scaleY;
            const twinkle = 0.5 + 0.3 * Math.sin(this.twinkleOffset * 2 + x * 0.01);
            const opacity = star.brightness * twinkle;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            this.ctx.fill();
        });
    }
    
    renderConnections() {
        this.ctx.lineWidth = 3;
        this.ctx.shadowBlur = 8;
        
        this.connections.forEach(conn => {
            // Create gradient line using colors from both stars
            const gradient = this.ctx.createLinearGradient(
                conn.star1.scaledX, conn.star1.scaledY,
                conn.star2.scaledX, conn.star2.scaledY
            );
            gradient.addColorStop(0, conn.star1.color + 'CC');
            gradient.addColorStop(1, conn.star2.color + 'CC');
            
            this.ctx.strokeStyle = gradient;
            this.ctx.shadowColor = conn.star1.color;
            
            this.ctx.beginPath();
            this.ctx.moveTo(conn.star1.scaledX, conn.star1.scaledY);
            this.ctx.lineTo(conn.star2.scaledX, conn.star2.scaledY);
            this.ctx.stroke();
        });
        
        this.ctx.shadowBlur = 0;
    }
    
    renderHintFlashes() {
        this.hintFlashes.forEach(flash => {
            if (!flash.active) return;
            
            const rgb = this.hexToRgb(flash.color);
            
            // Create pulsing radial gradient
            const gradient = this.ctx.createRadialGradient(
                flash.x, flash.y, 0,
                flash.x, flash.y, flash.radius
            );
            
            gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${flash.opacity * 0.3})`);
            gradient.addColorStop(0.6, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${flash.opacity * 0.15})`);
            gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    renderParticles() {
        this.particles.forEach(particle => {
            const sparkleIntensity = Math.sin(particle.sparkle) * 0.5 + 0.5;
            const alpha = particle.life * sparkleIntensity;
            
            const rgb = this.hexToRgb(particle.color);
            
            // Create glowing particle
            const gradient = this.ctx.createRadialGradient(
                particle.x, particle.y, 0,
                particle.x, particle.y, particle.size * 2
            );
            
            gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
            gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.5})`);
            gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    renderLightRays() {
        this.stars.forEach(star => {
            const rayIntensity = Math.sin(this.celebrationTime * 3 + star.scaledX * 0.01) * 0.3 + 0.4;
            const rayLength = 100 + Math.sin(this.celebrationTime * 2) * 50;
            
            const rgb = this.hexToRgb(star.color);
            
            // Create radiating light rays
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + this.celebrationTime;
                const endX = star.scaledX + Math.cos(angle) * rayLength;
                const endY = star.scaledY + Math.sin(angle) * rayLength;
                
                const gradient = this.ctx.createLinearGradient(
                    star.scaledX, star.scaledY, endX, endY
                );
                
                gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rayIntensity * 0.3})`);
                gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rayIntensity * 0.1})`);
                gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
                
                this.ctx.strokeStyle = gradient;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(star.scaledX, star.scaledY);
                this.ctx.lineTo(endX, endY);
                this.ctx.stroke();
            }
        });
    }
    
    renderMatarikiStars() {
        this.stars.forEach(star => {
            const twinkle = 0.7 + 0.3 * Math.sin(this.twinkleOffset + star.scaledX * 0.01);
            const baseRadius = 6 + star.brightness * 10;
            
            // Apply effects
            let radius = baseRadius;
            let offsetX = 0;
            let offsetY = 0;
            
            if (star.celebrating) {
                const celebrationPulse = Math.sin(this.celebrationTime * 4) * 0.3 + 1.2;
                radius *= celebrationPulse;
            }
            
            if (star.jiggling) {
                const jiggleAmount = 3;
                offsetX = (Math.random() - 0.5) * jiggleAmount;
                offsetY = (Math.random() - 0.5) * jiggleAmount;
            }
            
            const finalX = star.scaledX + offsetX;
            const finalY = star.scaledY + offsetY;
            const opacity = star.brightness * twinkle;
            
            const starColor = star.discovered ? star.color : '#FFFFFF';
            const rgb = this.hexToRgb(starColor);
            
            // Clickable indicator ring for discovered stars (but not during celebration)
            if (star.discovered && !this.isCelebrating) {
                const pulseRadius = radius * 4 + 2 * Math.sin(this.twinkleOffset * 2);
                this.ctx.beginPath();
                this.ctx.arc(finalX, finalY, pulseRadius, 0, Math.PI * 2);
                this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
            
            // Outer glow
            const gradient = this.ctx.createRadialGradient(
                finalX, finalY, 0,
                finalX, finalY, radius * 4
            );
            
            gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.8})`);
            gradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.4})`);
            gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.1})`);
            gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
            
            this.ctx.beginPath();
            this.ctx.arc(finalX, finalY, radius * 4, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();
            
            // Main star
            this.ctx.beginPath();
            this.ctx.arc(finalX, finalY, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
            this.ctx.fill();
            
            // Inner bright core
            this.ctx.beginPath();
            this.ctx.arc(finalX, finalY, radius * 0.4, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.8})`;
            this.ctx.fill();
            
            // Star name (only for discovered stars)
            if (star.discovered) {
                this.ctx.fillStyle = starColor;
                this.ctx.font = 'bold 14px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                this.ctx.lineWidth = 3;
                this.ctx.strokeText(star.name, finalX, finalY - radius - 12);
                this.ctx.fillText(star.name, finalX, finalY - radius - 12);
            }
        });
    }
    
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.matarikiGame = new MatarikiGame();
});