package net.xion.client.mixin;

import net.minecraft.client.gui.Gui;
import net.xion.client.feature.Crosshair;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Hides the vanilla crosshair while a Xion Premium crosshair is active (drawn by HudManager instead). */
@Mixin(Gui.class)
public class CrosshairMixin {
	//#if MC >= 260000
	@Inject(method = "extractCrosshair", at = @At("HEAD"), cancellable = true, require = 0)
	//#else
	@Inject(method = "renderCrosshair", at = @At("HEAD"), cancellable = true, require = 0)
	//#endif
	private void xion$customCrosshair(CallbackInfo ci) {
		if (Crosshair.replacesVanilla()) ci.cancel();
	}
}
