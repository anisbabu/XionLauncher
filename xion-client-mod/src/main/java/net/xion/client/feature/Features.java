package net.xion.client.feature;

import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.xion.client.XionConfig;
//#if MC >= 11900
import net.xion.client.mixin.OptionInstanceAccessor;
//#endif

/** Gameplay toggles from the Xion menu: Auto Sprint and Fullbright. */
public final class Features {
	private static boolean brightApplied;
	private static double savedGamma = 0.5;

	private Features() {}

	public static void tick(Minecraft mc) {
		LocalPlayer p = mc.player;
		if (p != null && XionConfig.data.autoSprint && mc.options.keyUp.isDown() && !p.isShiftKeyDown() && !p.isUsingItem()
			&& !p.horizontalCollision && (p.getFoodData().getFoodLevel() > 6 || p.getAbilities().mayfly)) {
			p.setSprinting(true);
		}

		if (XionConfig.data.fullbright != brightApplied) {
			if (XionConfig.data.fullbright) {
				savedGamma = gamma(mc);
				setGamma(mc, 16.0);
			} else {
				setGamma(mc, Math.min(1.0, savedGamma));
			}
			brightApplied = XionConfig.data.fullbright;
		}
	}

	private static double gamma(Minecraft mc) {
		//#if MC >= 11900
		return mc.options.gamma().get();
		//#else
		return mc.options.gamma;
		//#endif
	}

	@SuppressWarnings("unchecked")
	private static void setGamma(Minecraft mc, double v) {
		//#if MC >= 11900
		((OptionInstanceAccessor<Double>) (Object) mc.options.gamma()).xion$setValue(v);
		//#else
		mc.options.gamma = v;
		//#endif
	}
}
