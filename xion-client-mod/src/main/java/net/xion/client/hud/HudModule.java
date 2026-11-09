package net.xion.client.hud;

import net.minecraft.client.Minecraft;
import net.xion.client.XionConfig;
import net.xion.client.compat.Colors;
import net.xion.client.compat.Gfx;
import net.xion.client.feature.Premium;
import net.xion.client.feature.Pvp;

/** A draggable HUD element. Subclasses draw at (0,0) within their own width/height. */
public abstract class HudModule {
	public final String id;
	public final String name;
	public final String description;
	/** Pro modules need Xion Premium (free in PvP mode). */
	public final boolean premium;
	/** Only exists in Xion PvP mode. */
	public boolean pvpOnly;
	private final boolean defEnabled;
	private final float defX;
	private final float defY;

	protected HudModule(String id, String name, String description, boolean defEnabled, float defX, float defY) {
		this(id, name, description, defEnabled, defX, defY, false);
	}

	protected HudModule(String id, String name, String description, boolean defEnabled, float defX, float defY, boolean premium) {
		this.id = id;
		this.name = name;
		this.description = description;
		this.defEnabled = defEnabled;
		this.defX = defX;
		this.defY = defY;
		this.premium = premium;
	}

	public XionConfig.ModuleState state() {
		return XionConfig.module(id, defEnabled, defX, defY);
	}

	/** Enabled and (for pro modules) unlocked. */
	public boolean enabled() {
		if (pvpOnly && !Pvp.active()) return false;
		return state().enabled && (!premium || Premium.active() || Pvp.active());
	}

	public float scale() {
		return Math.max(0.5f, Math.min(2f, state().scale));
	}

	/** Text colour from the module's settings; chroma and custom colours are Premium. */
	public int textColor() {
		XionConfig.ModuleState s = state();
		if (!Premium.active()) return s.color == Colors.ACCENT ? Colors.ACCENT : Colors.TEXT;
		return s.chroma ? Colors.chroma(0) : s.color;
	}

	public boolean background() {
		return XionConfig.data.hudBackground && state().background;
	}

	public abstract int width(Minecraft mc);

	public abstract int height(Minecraft mc);

	/** @param preview true when drawn in the HUD editor (possibly without a world). */
	public abstract void render(Gfx g, Minecraft mc, boolean preview);

	public int scaledWidth(Minecraft mc) {
		return Math.round(width(mc) * scale());
	}

	public int scaledHeight(Minecraft mc) {
		return Math.round(height(mc) * scale());
	}

	public int x(int screenW, Minecraft mc) {
		return clamp(Math.round(state().x * screenW), screenW - Math.round(width(mc) * scale()));
	}

	public int y(int screenH, Minecraft mc) {
		return clamp(Math.round(state().y * screenH), screenH - Math.round(height(mc) * scale()));
	}

	private static int clamp(int v, int max) {
		return Math.max(0, Math.min(v, Math.max(0, max)));
	}
}
