import { AfterburnerMeasurement } from "../models/AfterburnerMeasurement";

export class SvgRenderer {
    public static render(measurement: AfterburnerMeasurement): string {
        const valStr: string = (measurement.Type.Format)
            ? measurement.Value.toFixed(3)
            : Math.round(measurement.Value).toFixed();

        const bar = {
            x: 30, y: 45,
            w: 0, h: 0,
        }
        bar.w = 100 - (bar.x * 2);
        bar.h = 100 - bar.y;
        const level = SvgRenderer.calculateLevel(measurement);
        const strokeWidth = 0.618;
        return `<svg width="100" height="100">
					<defs>
						<!-- BAR GRADIENT -->
						<linearGradient id="gradient" x1="0%" y1="100%" x2="0%" y2="0%">
							<stop offset="34%" stop-color="green" />
							<stop offset="61.8%" stop-color="orange" />
							<stop offset="100%" stop-color="darkred" />
						</linearGradient>
						
						<!-- BAR BORDER MASK -->
						<mask id="border-bg">
							<!-- Fill everything -->
							<rect x="0" y="0" width="100%" height="100%" fill="white" />
							<!-- Cut out the rect for border -->
							<rect x="${bar.x}" y="${bar.y}" width="${bar.w}" height="${bar.h}" fill="black" />
						</mask>
						
						<!-- BAR CUTOUT REMAINING MASK -->
						<mask id="bar-cutout-remaining">
							<!-- Fill everything -->
							<rect x="0" y="0" width="100%" height="100%" fill="white" />
							<!-- Cut out remianing part of the bar -->
							<rect x="${bar.x}" y="${bar.y}" width="${bar.w}" height="${bar.h - (level * bar.h)}" fill="black" />
						</mask>
					</defs>
					
					<!-- Clear all -->
					<rect x="0" y="0" width="100%" height="100%" fill="black" />
					
					<!-- BAR BORDER - outer stroke -->
					<rect fill="none" stroke="lightgray" 
						mask="url(#border-bg)"
						stroke-width="${strokeWidth}" 
						x="${bar.x - strokeWidth / 2}"
						y="${bar.y - strokeWidth / 2}" 
						width="${bar.w + strokeWidth}" 
						height="${bar.h + strokeWidth}" 
					/>
					
					<!-- BAR - fill 100% -->
					<rect 
						fill="url(#gradient)"
						mask="url(#bar-cutout-remaining)"
						x="${bar.x}" 
						y="${bar.y}"
						width="${bar.w}" 
						height="${bar.h}"
					/>
						
					<!-- TYPE -->
					<text x="50" y="15"
						text-anchor="middle"
						font-size="10" 
						fill="lightgray"
					>
						${measurement.Type.Name}
					</text>
					
					<!-- VALUE and UNIT -->
					<text x="56" y="35"
						text-anchor="middle"
						font-size="19" 
						fill="white"
						font-weight="bold"
					>
						${valStr}<tspan font-size="8" font-weight="lighter" fill="lightgray" alignment-baseline="middle">${measurement.Type.Unit}</tspan>
					</text>
				</svg>`;
    }

    private static calculateLevel(measurement: AfterburnerMeasurement): number {
        if (   measurement.Type.Max === 0
            || measurement.Type.Max <= measurement.Type.Min) {
            return 0;
        }

        return Math.min(1.0, Math.max(0.0,
            (measurement.Value - measurement.Type.Min) / (measurement.Type.Max - measurement.Type.Min)));
    }
}
