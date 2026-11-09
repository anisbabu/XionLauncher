package net.xion.client.gui;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.SharedConstants;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.util.Util;
import net.xion.client.XionClient;

/** Replaces the vanilla title screen with the Xion main menu. */
public class XionTitleScreen extends Screen {
	private static final Identifier LOGO = XionClient.id("textures/gui/logo.png");
	private final long openedAt = Util.getMillis();

	public XionTitleScreen() {
		super(Component.literal("Xion Client"));
	}

	@Override
	protected void init() {
		int cx = width / 2;
		int top = height / 2 - 22;
		int bw = 210;

		addRenderableWidget(new XionButton(cx - bw / 2, top, bw, 22, "Singleplayer", XionButton.Style.PRIMARY,
			() -> minecraft.gui.setScreen(new SelectWorldScreen(this))));
		addRenderableWidget(new XionButton(cx - bw / 2, top + 27, bw, 22, "Multiplayer", XionButton.Style.GLASS,
			() -> minecraft.gui.setScreen(new JoinMultiplayerScreen(this))));

		int sw = (bw - 8) / 3;
		int row = top + 54;
		addRenderableWidget(new XionButton(cx - bw / 2, row, sw, 20, "Options", XionButton.Style.GLASS,
			() -> minecraft.gui.setScreen(new OptionsScreen(this, minecraft.options))));
		addRenderableWidget(new XionButton(cx - bw / 2 + sw + 4, row, sw, 20, "Mods", XionButton.Style.GLASS,
			() -> minecraft.gui.setScreen(modsScreen())));
		addRenderableWidget(new XionButton(cx - bw / 2 + (sw + 4) * 2, row, bw - (sw + 4) * 2, 20, "Quit", XionButton.Style.DANGER,
			minecraft::stop));

		addRenderableWidget(new XionButton(cx - bw / 2, row + 25, bw, 18, "Xion HUD & Mods", XionButton.Style.GLASS,
			() -> minecraft.gui.setScreen(new XionModsScreen(this))));
	}

	/** Uses Mod Menu's screen when installed, otherwise the Xion mods screen. */
	private Screen modsScreen() {
		if (FabricLoader.getInstance().isModLoaded("modmenu")) {
			try {
				Class<?> c = Class.forName("com.terraformersmc.modmenu.gui.ModsScreen");
				return (Screen) c.getConstructor(Screen.class).newInstance(this);
			} catch (ReflectiveOperationException ignored) {
			}
		}
		return new XionModsScreen(this);
	}

	@Override
	public void extractBackground(GuiGraphicsExtractor g, int mouseX, int mouseY, float partialTick) {
		extractPanorama(g, partialTick);
		// Brand tint: deep purple vignette over the panorama.
		g.fillGradient(0, 0, width, height, 0x99070612, 0xE6070612);
		g.fillGradient(0, 0, width, height / 3, 0x55301A6E, 0x00000000);
	}

	@Override
	public void extractRenderState(GuiGraphicsExtractor g, int mouseX, int mouseY, float partialTick) {
		float t = Math.min(1f, (Util.getMillis() - openedAt) / 600f);
		float ease = 1f - (1f - t) * (1f - t);
		int cx = width / 2;
		int logoY = height / 2 - 112 + (int) ((1f - ease) * 10);

		g.blit(RenderPipelines.GUI_TEXTURED, LOGO, cx - 24, logoY - 6, 0f, 0f, 48, 48, 48, 48, Draw.withAlpha(0xFFFFFFFF, ease));

		Draw.centeredScaledText(g, font, "X I O N", cx, logoY + 46, 2.2f, Draw.withAlpha(Draw.TEXT, ease), true);
		Draw.centeredScaledText(g, font, "C L I E N T", cx, logoY + 68, 0.75f, Draw.withAlpha(0xFFC4A8FF, ease), false);

		for (var child : children()) {
			if (child instanceof XionButton b) b.setAlpha(ease);
		}
		super.extractRenderState(g, mouseX, mouseY, partialTick);

		// Footer
		String left = "Xion Client " + XionClient.VERSION + "  ·  Minecraft " + SharedConstants.getCurrentVersion().name();
		g.text(font, left, 6, height - 12, 0xFF77758C, false);
		String right = "Copyright Mojang AB. Do not distribute!";
		g.text(font, right, width - font.width(right) - 6, height - 12, 0xFF77758C, false);

		String user = "Signed in as " + minecraft.getUser().getName();
		int uw = font.width(user) + 16;
		Draw.rounded(g, width - uw - 6, 6, uw, 16, 0x99101018);
		g.fill(width - uw, 11, width - uw + 4, 15, 0xFF34E08F);
		g.text(font, user, width - uw + 6, 10, Draw.TEXT, false);
	}

	@Override
	public boolean shouldCloseOnEsc() {
		return false;
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}
}
