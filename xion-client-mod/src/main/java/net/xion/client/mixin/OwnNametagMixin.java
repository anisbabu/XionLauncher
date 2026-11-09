package net.xion.client.mixin;

import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.world.entity.LivingEntity;
import net.xion.client.XionConfig;
import net.xion.client.compat.Compat;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** In third person, shows your own nametag (with the Xion badge) like Lunar/Feather do. */
@Mixin(LivingEntityRenderer.class)
public abstract class OwnNametagMixin {
	//#if MC >= 12102
	@Inject(method = "shouldShowName(Lnet/minecraft/world/entity/LivingEntity;D)Z", at = @At("RETURN"), cancellable = true)
	private void xion$own(LivingEntity entity, double distSq, CallbackInfoReturnable<Boolean> cir) {
		if (xion$show(entity)) cir.setReturnValue(true);
	}
	//#else
	@Inject(method = "shouldShowName(Lnet/minecraft/world/entity/LivingEntity;)Z", at = @At("RETURN"), cancellable = true)
	private void xion$own(LivingEntity entity, CallbackInfoReturnable<Boolean> cir) {
		if (xion$show(entity)) cir.setReturnValue(true);
	}
	//#endif

	private static boolean xion$show(LivingEntity entity) {
		Minecraft mc = Minecraft.getInstance();
		return XionConfig.data.badge && entity == mc.player && !Compat.firstPerson() && !Compat.hudHidden() && !entity.isInvisible();
	}
}
