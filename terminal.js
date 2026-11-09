class Terminal {

	constructor(font,fontSize,w,h,palette) {
		this.canvas=document.getElementById("canvas");
		this.canvas.width=w;
		this.canvas.height=h;
		
		// Make canvas focusable and focus it on click[cite: 3]
		this.canvas.setAttribute('tabindex', '1');
		this.canvas.style.outline = 'none';
		this.canvas.addEventListener('click', () => {
			this.canvas.focus();
		});

		this.ctx=canvas.getContext("2d");
		this.font=font;
		this.fontSize=fontSize;
		this.palette=palette;
		this.backgroundColor=palette[0];
		this.textColor=palette[12];
		this.textBackground=palette[0];
		
		this.inputBuffer = [];
		this.inputResolve = null;
		this.EOF = -1;

		// Input boundary tracking
		this.inputStartX = 0;
		this.inputStartY = 0;

		// Cursor blink state
		this.cursorVisible = true;
		setInterval(() => {
			this.cursorVisible = !this.cursorVisible;
			let maxOffset = Math.max(0, this.lines.length - this.rows);
			if (this.scrollOffset === maxOffset || this.scrollOffset === Math.max(0, this.cursorY - this.rows + 1)) {
				this.render();
			}
		}, 500); // Blink every 500ms

		// Buffer configuration
		this.maxBufferLines = 1024;
		this.cols = Math.floor(w / (this.font.width * this.fontSize));
		this.rows = Math.floor(h / (this.font.height * this.fontSize));
		
		// Store lines: Array of Arrays containing character objects {code, bg, fg}
		this.lines = [[]]; 
		this.cursorX = 0;
		this.cursorY = 0;
		this.scrollOffset = 0; // 0 = viewing bottom-most lines

		// ANSI Parser state
		this.ansiState = 'NORMAL'; // 'NORMAL', 'ESC', 'CSI'
		this.ansiBuffer = '';

		// ANSI Color Mappings (Standard 16 colors)
		this.ansiColors = [
			palette[0],  // 30: Black
			palette[2],  // 31: Red
			palette[6],  // 32: Green
			palette[4],  // 33: Yellow
			palette[9],  // 34: Blue
			palette[1],  // 35: Magenta
			palette[11], // 36: Cyan
			palette[12]  // 37: White
		];
		this.ansiBrightColors = [
			palette[14], // 90: Bright Black (Gray)
			palette[3],  // 91: Bright Red
			palette[5],  // 92: Bright Green
			palette[4],  // 93: Bright Yellow
			palette[10], // 94: Bright Blue
			palette[13], // 95: Bright Magenta
			palette[11], // 96: Bright Cyan
			palette[12]  // 97: Bright White
		];

		// Listen to keyboard events
		window.addEventListener('keydown', (e) => {
			if (document.activeElement !== this.canvas) return;

			// Handle scrolling keys
			if (e.key === 'PageUp') {
				e.preventDefault();
				this.scrollPage(-1);
				return;
			} else if (e.key === 'PageDown') {
				e.preventDefault();
				this.scrollPage(1);
				return;
			}

			let charCode = null;
			if (e.key === 'Tab') {
				e.preventDefault(); 
				charCode = 9;       
			} else if (e.key.length === 1) {
				charCode = e.key.charCodeAt(0);
			} else if (e.key === 'Enter') {
				charCode = 10; 
			} else if (e.key === 'Backspace') {
				charCode = 8;
			}

			if (charCode !== null) {
				// Snap viewport back to the bottom when a key is pressed
				let maxOffset = Math.max(0, this.lines.length - this.rows);
				this.scrollOffset = maxOffset;

				if (this.inputResolve) {
					let resolve = this.inputResolve;
					this.inputResolve = null;
					resolve(charCode);
				} else {
					this.inputBuffer.push(charCode);
				}
			}
		});
	}

	setup() {
		this.render();
	}

	scrollPage(direction) {
		let maxOffset = Math.max(0, this.lines.length - this.rows);
		this.scrollOffset += direction * this.rows;
		
		// Clamp offset bounds
		if (this.scrollOffset < 0) this.scrollOffset = 0;
		if (this.scrollOffset > maxOffset) this.scrollOffset = maxOffset;
		
		this.render();
	}

	putchar(code) {
		let ch = String.fromCharCode(code);

		if (this.ansiState === 'NORMAL') {
			if (code === 27) { // ESC
				this.ansiState = 'ESC';
				this.ansiBuffer = '';
			} else {
				this.processChar(code);
			}
		} else if (this.ansiState === 'ESC') {
			if (ch === '[') {
				this.ansiState = 'CSI';
				this.ansiBuffer = '';
			} else {
				this.ansiState = 'NORMAL';
				this.processChar(code);
			}
		} else if (this.ansiState === 'CSI') {
			if ((code >= 0x30 && code <= 0x3F) || (code >= 0x20 && code <= 0x2F)) {
				this.ansiBuffer += ch;
			} else if (code >= 0x40 && code <= 0x7E) {
				this.handleCSI(ch, this.ansiBuffer);
				this.ansiState = 'NORMAL';
			} else {
				this.ansiState = 'NORMAL';
			}
		}	

		// Ensure viewport scrolls down to keep cursor visible when wrapping or outputting
		let maxOffset = Math.max(0, this.lines.length - this.rows);
		if (this.cursorY >= this.scrollOffset + this.rows) {
			this.scrollOffset = this.cursorY - this.rows + 1;
		}
		if (this.scrollOffset > maxOffset) {
			this.scrollOffset = maxOffset;
		}

		this.render();
	}

	processChar(code) {
		while (this.lines.length <= this.cursorY) {
			this.lines.push([]);
		}
		let currentLine = this.lines[this.cursorY];

		switch(code) {
			case 13: 
				this.cursorX = 0;
				break;
			case 10: 
				this.cursorY++;
				while (this.lines.length <= this.cursorY) {
					this.lines.push([]);
				}
				this.cursorX = 0;
				if (this.lines.length > this.maxBufferLines) {
					this.lines.shift();
					this.cursorY = Math.max(0, this.cursorY - 1);
				}
				break;
			case 9: 
				for (let i = 0; i < 4; i++) {
					this.processChar(32);
				}
				break;
			case 8: // Backspace
				if (this.cursorY > this.inputStartY || (this.cursorY === this.inputStartY && this.cursorX > this.inputStartX)) {
					if (this.cursorX > 0) {
						this.cursorX--;
						while (currentLine.length <= this.cursorX) {
							currentLine.push({ code: 32, bg: this.textBackground, fg: this.textColor });
						}
						currentLine[this.cursorX] = {
							code: 32,
							bg: this.textBackground,
							fg: this.textColor
						};
					} else if (this.cursorY > this.inputStartY) {
						this.cursorY--;
						this.cols = Math.floor(this.canvas.width / (this.font.width * this.fontSize));
						this.cursorX = this.cols - 1;
						currentLine = this.lines[this.cursorY];
						if (currentLine && currentLine.length > this.cursorX) {
							currentLine[this.cursorX] = {
								code: 32,
								bg: this.textBackground,
								fg: this.textColor
							};
						}
					}
				}
				break;
			default:
				while (currentLine.length <= this.cursorX) {
					currentLine.push({ code: 32, bg: this.textBackground, fg: this.textColor });
				}
				currentLine[this.cursorX] = {
					code: code,
					bg: this.textBackground,
					fg: this.textColor
				};
				this.cursorX++;
				
				if (this.cursorX >= this.cols) {
					this.cursorX = 0;
					this.cursorY++;
					while (this.lines.length <= this.cursorY) {
						this.lines.push([]);
					}
					if (this.lines.length > this.maxBufferLines) {
						this.lines.shift();
						this.cursorY = Math.max(0, this.cursorY - 1);
					}
				}
				break;
		}
	}

	handleCSI(finalChar, paramStr) {
		let params = paramStr.split(';').map(p => p === '' ? 0 : parseInt(p, 10));

		switch (finalChar) {
			case 'm': // SGR - Select Graphic Rendition
				if (params.length === 0 || (params.length === 1 && params[0] === 0)) {
					this.textColor = this.palette[12];
					this.textBackground = this.palette[0];
				} else {
					for (let i = 0; i < params.length; i++) {
						let p = params[i];
						if (p === 0) {
							this.textColor = this.palette[12];
							this.textBackground = this.palette[0];
						} else if (p >= 30 && p <= 37) {
							this.textColor = this.ansiColors[p - 30];
						} else if (p >= 90 && p <= 97) {
							this.textColor = this.ansiBrightColors[p - 90];
						} else if (p >= 40 && p <= 47) {
							this.textBackground = this.ansiColors[p - 40];
						} else if (p >= 100 && p <= 107) {
							this.textBackground = this.ansiBrightColors[p - 100];
						} else if (p === 39) {
							this.textColor = this.palette[12];
						} else if (p === 49) {
							this.textBackground = this.palette[0];
						} else if (p === 38 && params[i+1] === 5 && params[i+2] !== undefined) {
							let colorIndex = params[i+2];
							if (colorIndex >= 0 && colorIndex < this.palette.length) {
								this.textColor = this.palette[colorIndex];
							}
							i += 2;
						} else if (p === 48 && params[i+1] === 5 && params[i+2] !== undefined) {
							let colorIndex = params[i+2];
							if (colorIndex >= 0 && colorIndex < this.palette.length) {
								this.textBackground = this.palette[colorIndex];
							}
							i += 2;
						}
					}
				}
				break;
			case 'A': // Cursor Up
				{
					let count = params[0] || 1;
					this.cursorY = Math.max(0, this.cursorY - count);
				}
				break;
			case 'B': // Cursor Down
				{
					let count = params[0] || 1;
					this.cursorY += count;
				}
				break;
			case 'C': // Cursor Forward
				{
					let count = params[0] || 1;
					this.cursorX += count;
					if (this.cursorX >= this.cols) this.cursorX = this.cols - 1;
				}
				break;
			case 'D': // Cursor Backward
				{
					let count = params[0] || 1;
					this.cursorX = Math.max(0, this.cursorX - count);
				}
				break;
			case 'H': // Cursor Position [row;col]
			case 'f':
				{
					let row = (params[0] || 1) - 1;
					let col = (params[1] || 1) - 1;
					this.cursorY = Math.max(0, row);
					this.cursorX = Math.max(0, col);
				}
				break;
			case 'J': // Erase in Display
				{
					let mode = params[0] || 0;
					if (mode === 2 || mode === 3) {
						this.cls();
					}
				}
				break;
			case 'K': // Erase in Line
				{
					let mode = params[0] || 0;
					while (this.lines.length <= this.cursorY) {
						this.lines.push([]);
					}
					let line = this.lines[this.cursorY];
					if (mode === 0) {
						line.splice(this.cursorX);
					} else if (mode === 1) {
						for (let i = 0; i < Math.min(this.cursorX, line.length); i++) {
							line[i] = { code: 32, bg: this.textBackground, fg: this.textColor };
						}
					} else if (mode === 2) {
						this.lines[this.cursorY] = [];
					}
				}
				break;
		}
	}

	render() {
		Graphics.fillRect(this.ctx, 0, 0, this.canvas.width, this.canvas.height, this.backgroundColor);

		let startLineIndex = this.scrollOffset;
		let maxLine = Math.max(this.lines.length, this.cursorY + 1);
		let endLineIndex = Math.min(maxLine, startLineIndex + this.rows);
		
		let charWidth = this.font.width * this.fontSize;
		let lineHeight = this.font.height * this.fontSize;

		for (let r = startLineIndex; r < endLineIndex; r++) {
			let line = this.lines[r] || [];
			let drawY = (r - startLineIndex) * lineHeight;

			for (let c = 0; c < line.length; c++) {
				let charObj = line[c];
				let drawX = c * charWidth;
				Graphics.drawChar(this.ctx, this.font, charObj.code, drawX, drawY, this.fontSize, charObj.bg, charObj.fg);
			}
		}

		// Render blinking block cursor if visible and within viewport rows
		if (this.cursorVisible) {
			let cursorRowScreen = this.cursorY - startLineIndex;
			if (cursorRowScreen >= 0 && cursorRowScreen < this.rows) {
				let drawX = this.cursorX * charWidth;
				let drawY = cursorRowScreen * lineHeight;

				let line = this.lines[this.cursorY];
				let charObj = (line && line[this.cursorX]) ? line[this.cursorX] : { code: 32, bg: this.textBackground, fg: this.textColor };

				// Draw filled background block using active text color
				Graphics.fillRect(this.ctx, drawX, drawY, charWidth, lineHeight, this.textColor);

				// Draw character on top with inverted colors
				Graphics.drawChar(this.ctx, this.font, charObj.code, drawX, drawY, this.fontSize, this.textColor, this.backgroundColor);
			}
		}
	}

	async getch() {
		let code;
		if (this.inputBuffer.length > 0) {
			code = this.inputBuffer.shift();
		} else {
			code = await new Promise((resolve) => {
				this.inputResolve = resolve;
			});
		}
		return code;
	}

	ungetch(code) {
		this.inputBuffer.unshift(code);
	}

	async getchar() {
		let code = await this.getch();
		this.putchar(code);
		return code;
	}

	print(text) {
		for(let i = 0; i < text.length; i++) {
			let ch = text.charCodeAt(i);
			this.putchar(ch);		
		}
		this.inputStartX = this.cursorX;
		this.inputStartY = this.cursorY;
	}

	cls() {
		this.lines = [[]];
		this.cursorX = 0;
		this.cursorY = 0;
		this.scrollOffset = 0;
		this.render();
	}

}
