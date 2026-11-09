class Graphics {

	static drawLine(ctx,x0,y0,x1,y1,color) {
		ctx.beginPath();
		ctx.strokeStyle=color;
		ctx.moveTo(x0,y0);
		ctx.lineTo(x1,y1);
		ctx.stroke();
		ctx.closePath();
	}

	static drawCircle(ctx,x,y,r,color) {
		ctx.beginPath();
		ctx.strokeStyle=color;
		ctx.arc(x,y,r,0,2*Math.PI);
		ctx.stroke();
		ctx.closePath();
	}

	static fillCircle(ctx,x,y,r,color) {
		ctx.beginPath();
		ctx.fillStyle=color;
		ctx.arc(x,y,r,0,2*Math.PI);
		ctx.fill();
		ctx.closePath();
	}

	static drawRect(ctx,x,y,w,h,color) {
		ctx.strokeStyle=color;
		ctx.strokeRect(x,y,w,h);
	}

	static fillRect(ctx,x,y,w,h,color) {
		ctx.fillStyle=color;
		ctx.fillRect(x,y,w,h);
	}

	static drawBitmap(ctx,frame,x,y,size,bitmap,palette) {
		for(let j=0;j<bitmap.height;j++) {
			for(let i=0;i<bitmap.width;i++) {
				let colorIndex=bitmap.pixels[i+j*bitmap.width+frame*bitmap.width*bitmap.height];
				let color=palette[colorIndex];
				this.fillRect(ctx,x+i*size,y+j*size,size,size,color);
			}
		}
	}

	static drawChar(ctx,font,frame,x,y,size,bg,fg) {
		for(let j=0;j<font.height;j++) {
			for(let i=0;i<font.width;i++) {
				let color=font.pixels[i+j*font.width+frame*font.width*font.height];
				if(color===0) {
					this.fillRect(ctx,x+i*size,y+j*size,size,size,bg);
				} else {
					this.fillRect(ctx,x+i*size,y+j*size,size,size,fg);
				}
			}
		}
	}

	static drawText(ctx,font,text,x,y,size,bg,fg) {
		for(let i=0;i<text.length;i++) {
			this.drawChar(ctx,font,text.charCodeAt(i),x+i*font.width*size,y,size,fg,bg);
		}
	}

}
