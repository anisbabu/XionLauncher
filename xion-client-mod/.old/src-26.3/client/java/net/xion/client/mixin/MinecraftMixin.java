package net.xion.client.mixin;

import net.minecraft.SharedConstants;
import net.minecraft.client.Minecraft;
import net.xion.client.XionClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Minecraft.class)
public abstract class MinecraftMixin {
	@Inject(method = "createTitle", at = @At("RETURN"), cancellable = true)
	private void xion$title(CallbackInfoReturnable<String> cir) {
		cir.setReturnValue("Xion Client " + XionClient.VERSION + " | " + SharedConstants.getCurrentVersion().name());
	}
}
