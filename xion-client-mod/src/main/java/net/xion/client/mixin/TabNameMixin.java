package net.xion.client.mixin;

import net.minecraft.client.gui.components.PlayerTabOverlay;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.network.chat.Component;
import net.xion.client.feature.Badge;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Shows the Xion badge before the names of you and other Xion Client players in the tab list. */
@Mixin(PlayerTabOverlay.class)
public abstract class TabNameMixin {
	@Inject(method = "getNameForDisplay", at = @At("RETURN"), cancellable = true)
	private void xion$badge(PlayerInfo info, CallbackInfoReturnable<Component> cir) {
		//#if MC >= 12109
		var id = info.getProfile().id();
		//#else
		var id = info.getProfile().getId();
		//#endif
		if (Badge.shows(id)) cir.setReturnValue(Badge.prefix(cir.getReturnValue(), id));
	}
}
