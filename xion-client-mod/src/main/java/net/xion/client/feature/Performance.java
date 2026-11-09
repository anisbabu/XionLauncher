package net.xion.client.feature;

import net.minecraft.client.CloudStatus;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Options;
import net.xion.client.XionConfig;

/**
 * Xion FPS presets, picked in Xion Launcher (Settings → Performance):
 *   boost  (free)   fast graphics, no clouds, fewer particles, no entity shadows, sane distances
 *   turbo  (Xion+)  everything in boost plus the heavy iGPU savers
 * A preset is applied once when the chosen mode changes, so players can still tweak options afterwards.
 */
public final class Performance {
	/**
	 * Uncapped frames keep every core at 100%, which starves the keyboard helpers Windows runs keys through
	 * (Discord, overlays, laptop hotkey tools) and makes keys arrive seconds late. A cap leaves them headroom.
	 */
	private static final int FPS_CAP = 144;
	/** Bump when the preset changes so it is applied once more. */
	private static final String REV = ":2";
	private static boolean checked;

	private Performance() {}

	public static String mode() {
		String m = XionConfig.launcher.perfMode == null ? "boost" : XionConfig.launcher.perfMode;
		if (m.equals("turbo") && !Premium.active()) return "boost";
		return m;
	}

	public static void tick(Minecraft mc) {
		if (!checked && mc.options != null) {
			checked = true;
			String m = mode();
			if (!(m + REV).equals(XionConfig.data.perfApplied)) {
				if (!m.equals("off")) apply(mc.options, m.equals("turbo"));
				XionConfig.data.perfApplied = m + REV;
				XionConfig.save();
			}
		}
	}

	private static void apply(Options o, boolean turbo) {
		int rd = Math.min(renderDistance(o), turbo ? 8 : 10);
		//#if MC >= 11900
		//#if MC >= 12111
		// The preset rewrites clouds, biome blend and more, so it must come first.
		o.applyGraphicsPreset(net.minecraft.client.GraphicsPreset.FAST);
		//#endif
		o.renderDistance().set(rd);
		o.simulationDistance().set(Math.min(o.simulationDistance().get(), turbo ? 6 : 8));
		o.cloudStatus().set(CloudStatus.OFF);
		o.entityShadows().set(false);
		o.enableVsync().set(false);
		o.framerateLimit().set(FPS_CAP);
		o.biomeBlendRadius().set(turbo ? 0 : 1);
		o.entityDistanceScaling().set(turbo ? 0.75 : 1.0);
		//#if MC >= 12111
		o.improvedTransparency().set(false);
		if (turbo) {
			o.cutoutLeaves().set(false);
			o.weatherRadius().set(Math.min(o.weatherRadius().get(), 5));
			o.chunkSectionFadeInTime().set(0.0);
		}
		//#else
		o.graphicsMode().set(net.minecraft.client.GraphicsStatus.FAST);
		//#endif
		//#if MC >= 12102
		o.particles().set(turbo ? net.minecraft.server.level.ParticleStatus.MINIMAL : net.minecraft.server.level.ParticleStatus.DECREASED);
		//#else
		o.particles().set(turbo ? net.minecraft.client.ParticleStatus.MINIMAL : net.minecraft.client.ParticleStatus.DECREASED);
		//#endif
		if (turbo) {
			o.mipmapLevels().set(0);
			//#if MC >= 11903
			o.ambientOcclusion().set(false);
			//#else
			o.ambientOcclusion().set(net.minecraft.client.AmbientOcclusionStatus.OFF);
			//#endif
		}
		//#else
		o.renderDistance = rd;
		o.simulationDistance = Math.min(o.simulationDistance, turbo ? 6 : 8);
		o.renderClouds = CloudStatus.OFF;
		o.entityShadows = false;
		o.enableVsync = false;
		o.framerateLimit = FPS_CAP;
		o.biomeBlendRadius = turbo ? 0 : 1;
		o.entityDistanceScaling = turbo ? 0.75f : 1.0f;
		o.graphicsMode = net.minecraft.client.GraphicsStatus.FAST;
		o.particles = turbo ? net.minecraft.client.ParticleStatus.MINIMAL : net.minecraft.client.ParticleStatus.DECREASED;
		if (turbo) {
			o.mipmapLevels = 0;
			o.ambientOcclusion = net.minecraft.client.AmbientOcclusionStatus.OFF;
		}
		//#endif
		o.save();
	}

	private static int renderDistance(Options o) {
		//#if MC >= 11900
		return o.renderDistance().get();
		//#else
		return o.renderDistance;
		//#endif
	}

}
