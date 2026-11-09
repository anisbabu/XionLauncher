package net.xion.client.mixin;

import net.minecraft.client.MouseHandler;
import net.xion.client.hud.HudManager;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
//#if MC >= 12109
import net.minecraft.client.input.MouseButtonInfo;
//#endif

/** Feeds the CPS counter with raw presses so clicks between ticks aren't lost. */
@Mixin(MouseHandler.class)
public abstract class MouseMixin {
	//#if MC >= 12109
	@Inject(method = "onButton", at = @At("HEAD"))
	private void xion$click(long window, MouseButtonInfo info, int action, CallbackInfo ci) {
		if (action == 1) HudManager.registerClick(net.xion.client.compat.Compat.button(info.button()));
	}
	//#else
	@Inject(method = "onPress", at = @At("HEAD"))
	private void xion$click(long window, int button, int action, int mods, CallbackInfo ci) {
		if (action == 1) HudManager.registerClick(button);
	}
	//#endif
}
