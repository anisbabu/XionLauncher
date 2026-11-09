package net.xion.client.mixin;

import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Player;
import net.xion.client.feature.Badge;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Prefixes the display name (used by nametags) of you and other Xion Client players with the Xion badge. */
@Mixin(Player.class)
public abstract class PlayerNameMixin {
	@Inject(method = "getDisplayName", at = @At("RETURN"), cancellable = true)
	private void xion$badge(CallbackInfoReturnable<Component> cir) {
		java.util.UUID id = ((Player) (Object) this).getUUID();
		if (Badge.shows(id)) cir.setReturnValue(Badge.prefix(cir.getReturnValue(), id));
	}
}
