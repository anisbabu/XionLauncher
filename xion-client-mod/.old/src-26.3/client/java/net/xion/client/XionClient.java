package net.xion.client;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.Identifier;
import net.xion.client.gui.XionModsScreen;
import net.xion.client.hud.HudManager;

public class XionClient implements ClientModInitializer {
	public static final String MOD_ID = "xionclient";
	public static final String VERSION = "1.0.0";

	private static KeyMapping menuKey;

	public static Identifier id(String path) {
		return Identifier.fromNamespaceAndPath(MOD_ID, path);
	}

	@Override
	public void onInitializeClient() {
		XionConfig.load();
		HudManager.init();

		KeyMapping.Category category = KeyMapping.Category.register(id("main"));
		menuKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.xionclient.menu", InputConstants.KEY_RSHIFT, category));

		HudElementRegistry.addLast(id("hud"), (graphics, delta) -> HudManager.render(graphics, false));

		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			while (menuKey.consumeClick()) {
				if (mc.gui.screen() == null) mc.gui.setScreen(new XionModsScreen(null));
			}
			if (PREVIEW && mc.level != null) previewTick(mc);
		});
	}

	// Dev aid (-Dxionclient.preview=true): cycles through the Xion screens in-world for screenshots.
	private static final boolean PREVIEW = Boolean.getBoolean("xionclient.preview");
	private static int previewTicks;

	private static void previewTick(Minecraft mc) {
		previewTicks++;
		if (previewTicks == 500) mc.gui.setScreen(new XionModsScreen(null));
		else if (previewTicks == 700) mc.gui.setScreen(new net.xion.client.gui.HudEditorScreen(null));
		else if (previewTicks == 900) mc.gui.setScreen(null);
	}

	public static Minecraft mc() {
		return Minecraft.getInstance();
	}
}
