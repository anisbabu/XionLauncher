package net.xion.client;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.xion.client.compat.Compat;
import net.xion.client.compat.Gfx;
import net.xion.client.compat.Ids;
import net.xion.client.feature.Features;
import net.xion.client.hud.HudManager;
import net.xion.client.ui.HudEditorScreen;
import net.xion.client.ui.XionMenuScreen;
//#if MC >= 260000
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
//#else
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
//#endif
//#if MC >= 12106
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
//#else
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
//#endif

public class XionClient implements ClientModInitializer {
	public static final String MOD_ID = "xionclient";
	public static final String VERSION = "1.7.0";
	private static final int KEY_RIGHT_SHIFT = 344;

	private static KeyMapping menuKey;

	@Override
	public void onInitializeClient() {
		XionConfig.load();
		net.xion.client.compat.Colors.applyTheme(XionConfig.launcher.theme.accent, XionConfig.launcher.theme.accent2);
		HudManager.init();

		//#if MC >= 260000
		menuKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.xionclient.menu", InputConstants.KEY_RSHIFT,
			KeyMapping.Category.register(Ids.of(MOD_ID, "main"))));
		//#elif MC >= 12109
		menuKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.xionclient.menu", InputConstants.Type.KEYSYM, KEY_RIGHT_SHIFT,
			KeyMapping.Category.register(Ids.of(MOD_ID, "main"))));
		//#else
		menuKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.xionclient.menu", InputConstants.Type.KEYSYM, KEY_RIGHT_SHIFT,
			"key.category.xionclient.main"));
		//#endif

		//#if MC >= 12106
		HudElementRegistry.addLast(Ids.of(MOD_ID, "hud"), (g, delta) -> {
			if (!Compat.hudHidden()) HudManager.render(new Gfx(g), false);
		});
		//#else
		HudRenderCallback.EVENT.register((g, delta) -> {
			if (!Compat.hudHidden()) HudManager.render(new Gfx(g), false);
		});
		//#endif

		//#if MC < 12002
		// Old versions draw buttons from widgets.png: repaint it after every resource reload.
		net.fabricmc.fabric.api.resource.ResourceManagerHelper.get(net.minecraft.server.packs.PackType.CLIENT_RESOURCES)
			.registerReloadListener(new net.fabricmc.fabric.api.resource.SimpleSynchronousResourceReloadListener() {
				@Override
				public net.minecraft.resources.ResourceLocation getFabricId() {
					return Ids.of(MOD_ID, "widget_skin");
		}

				@Override
				public void onResourceManagerReload(net.minecraft.server.packs.resources.ResourceManager manager) {
					net.xion.client.feature.WidgetSkin.apply();
		}
			});
		//#endif

		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			while (menuKey.consumeClick()) {
				if (Compat.screen() == null) Compat.setScreen(new XionMenuScreen(null, XionMenuScreen.Tab.MODS));
			}
			if (mc.level != null && joinedAt == 0) joinedAt = System.currentTimeMillis();
			else if (mc.level == null) joinedAt = 0;
			HudManager.tick(mc);
			net.xion.client.feature.Presence.tick(mc);
			net.xion.client.feature.StoreCosmetics.tick(mc);
			Features.tick(mc);
			net.xion.client.feature.Performance.tick(mc);
			if (PREVIEW) previewTick();
		});
	}

	private static long joinedAt;

	/** Minutes since joining the current world or server. */
	public static long sessionMinutes() {
		return joinedAt == 0 ? 0 : (System.currentTimeMillis() - joinedAt) / 60000L;
	}

	// Dev aid (-Dxionclient.preview=true): cycles through the Xion screens in-world for screenshots.
	private static final boolean PREVIEW = Boolean.getBoolean("xionclient.preview");
	private static int previewTicks;

	private static void previewTick() {
		// Start counting once the main menu or a world is visible.
		if (previewTicks == 0 && Minecraft.getInstance().level == null && !(Compat.screen() instanceof net.xion.client.ui.XionTitleScreen)) return;
		previewTicks++;
		Minecraft mc = Minecraft.getInstance();
		if (previewTicks == 200) Compat.setScreen(new XionMenuScreen(null, XionMenuScreen.Tab.HUD));
		else if (previewTicks == 300) Compat.setScreen(new XionMenuScreen(null, XionMenuScreen.Tab.PREMIUM));
		else if (previewTicks == 360) Compat.setScreen(new XionMenuScreen(null, XionMenuScreen.Tab.MODS));
		else if (previewTicks == 420) Compat.setScreen(new net.xion.client.ui.ModuleSettingsScreen(null,
			HudManager.MODULES.stream().filter(m -> m.id.equals("fps")).findFirst().orElse(HudManager.MODULES.get(0))));
		else if (previewTicks == 480) Compat.setScreen(new HudEditorScreen(null));
		else if (previewTicks == 560) {
			if (mc.level != null) Compat.setScreen(new net.xion.client.ui.XionPauseScreen());
			else Compat.setScreen(net.xion.client.ui.XionTitleScreen.optionsScreen(null));
		} else if (previewTicks == 660 && mc.level != null) {
			Compat.press(Compat.vanillaPause(), "menu.options");
		} else if (previewTicks == 760) {
			Compat.setScreen(null);
			mc.options.setCameraType(net.minecraft.client.CameraType.THIRD_PERSON_FRONT);
		}
	}
}
