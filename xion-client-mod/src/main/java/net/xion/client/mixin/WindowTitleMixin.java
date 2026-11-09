package net.xion.client.mixin;

import net.minecraft.client.Minecraft;
import net.xion.client.XionClient;
import net.xion.client.compat.Compat;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Minecraft.class)
public abstract class WindowTitleMixin {
	@Inject(method = "createTitle", at = @At("RETURN"), cancellable = true)
	private void xion$title(CallbackInfoReturnable<String> cir) {
		cir.setReturnValue("Xion Client " + XionClient.VERSION + " | " + Compat.MC_VERSION);
	}
}
