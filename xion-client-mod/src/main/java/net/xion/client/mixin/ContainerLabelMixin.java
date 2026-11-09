package net.xion.client.mixin;

import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.client.gui.screens.inventory.CreativeModeInventoryScreen;
import net.minecraft.client.gui.screens.inventory.InventoryScreen;
import net.minecraft.client.gui.screens.inventory.MerchantScreen;
import net.xion.client.feature.DarkUi;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.ModifyConstant;

/** Light container titles ("Inventory", "Chest", ...) while the dark Xion Pack is on. These four screens draw them. */
@Mixin({ AbstractContainerScreen.class, InventoryScreen.class, CreativeModeInventoryScreen.class, MerchantScreen.class })
public abstract class ContainerLabelMixin {
//#if MC >= 260000
	@ModifyConstant(method = "extractLabels", constant = @Constant(intValue = 0xFF404040), require = 0)
//#elif MC >= 12106
	@ModifyConstant(method = "renderLabels", constant = @Constant(intValue = 0xFF404040), require = 0)
//#else
	@ModifyConstant(method = "renderLabels", constant = @Constant(intValue = 0x404040), require = 0)
//#endif
	private int xion$labelColor(int color) {
		return DarkUi.label(color);
	}
}
