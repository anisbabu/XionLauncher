package net.xion.client.hud;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.xion.client.XionConfig;

/** A draggable HUD element. Subclasses draw at (0,0) within their own width/height. */
public abstract class HudModule {
	public final String id;
	public final String name;
	public final String description;
	private final boolean defEnabled;
	private final float defX;
	private final float defY;

	protected HudModule(String id, String name, String description, boolean defEnabled, float defX, float defY) {
		this.id = id;
		this.name = name;
		this.description = description;
		this.defEnabled = defEnabled;
		this.defX = defX;
		this.defY = defY;
	}

	public XionConfig.ModuleState state() {
		return XionConfig.module(id, defEnabled, defX, defY);
	}

	public boolean enabled() {
		return state().enabled;
	}

	public abstract int width(Minecraft mc);

	public abstract int height(Minecraft mc);

	/** @param preview true when drawn in the HUD editor without a world loaded. */
	public abstract void render(GuiGraphicsExtractor g, Minecraft mc, boolean preview);

	public int x(int screenW, Minecraft mc) {
		return clamp(Math.round(state().x * screenW), screenW - width(mc));
	}

	public int y(int screenH, Minecraft mc) {
		return clamp(Math.round(state().y * screenH), screenH - height(mc));
	}

	private static int clamp(int v, int max) {
		return Math.max(0, Math.min(v, Math.max(0, max)));
	}
}
