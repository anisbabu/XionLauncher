package net.xion.client.hud;

import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.xion.client.XionConfig;
import net.xion.client.compat.Colors;
import net.xion.client.compat.Compat;
import net.xion.client.compat.Gfx;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.function.Function;

public final class HudManager {
	public static final List<HudModule> MODULES = new ArrayList<>();
	private static final Deque<Long> LEFT = new ArrayDeque<>();
	private static final Deque<Long> RIGHT = new ArrayDeque<>();
	private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");
	private static int frames, fps;
	private static long fpsWindow;
	private static double lastX, lastZ, speed;
	private static boolean hasLast;

	private HudManager() {}

	public static void init() {
		MODULES.add(text("fps", "FPS", "Frames per second", true, 0.01f, 0.02f, mc -> fps + " FPS"));
		MODULES.add(text("cps", "CPS", "Left | right clicks per second", true, 0.01f, 0.09f,
			mc -> cps(LEFT) + " | " + cps(RIGHT) + " CPS"));
		MODULES.add(text("coords", "Coordinates", "Position and facing", true, 0.01f, 0.16f, mc -> mc.player == null
			? "XYZ 128 64 -32  N"
			: String.format("XYZ %d %d %d  %s", mc.player.getBlockX(), mc.player.getBlockY(), mc.player.getBlockZ(), facing(mc))));
		MODULES.add(text("ping", "Ping", "Latency to the server", true, 0.01f, 0.23f, HudManager::ping));
		MODULES.add(text("speed", "Speed", "Horizontal speed in blocks/s", false, 0.01f, 0.30f,
			mc -> String.format("%.1f b/s", speed)));
		MODULES.add(text("clock", "Clock", "Real-world time", false, 0.01f, 0.37f, mc -> LocalTime.now().format(CLOCK)));
		MODULES.add(text("day", "Day Counter", "In-game day number", false, 0.01f, 0.44f,
			mc -> "Day " + (mc.level == null ? 1 : dayTime(mc) / 24000L + 1)));
		MODULES.add(text("memory", "Memory", "Java memory usage", false, 0.01f, 0.51f, mc -> {
			Runtime rt = Runtime.getRuntime();
			long used = (rt.totalMemory() - rt.freeMemory()) >> 20;
			return "MEM " + used * 100 / Math.max(1, rt.maxMemory() >> 20) + "%";
		}));
		MODULES.add(text("server", "Server Address", "Server you're playing on", false, 0.01f, 0.58f, mc -> {
			ServerData s = mc.getCurrentServer();
			return s != null ? s.ip : (mc.hasSingleplayerServer() ? "Singleplayer" : "play.xion.gg");
		}));
		MODULES.add(text("direction", "Direction", "Compass heading and degrees", false, 0.01f, 0.65f, HudManager::direction));
		MODULES.add(text("light", "Light Level", "Block light where you stand (mob spawning)", false, 0.01f, 0.72f, mc -> mc.level == null || mc.player == null
			? "Light 15" : "Light " + mc.level.getMaxLocalRawBrightness(mc.player.blockPosition())));
		MODULES.add(text("session", "Session Time", "How long you have been playing", false, 0.01f, 0.79f, mc -> {
			long m = net.xion.client.XionClient.sessionMinutes();
			return String.format("Session %d:%02d", m / 60, m % 60);
		}));
		MODULES.add(text("saturation", "Saturation", "Hidden hunger saturation", false, 0.01f, 0.86f, mc -> mc.player == null
			? "Saturation 5.0" : String.format("Saturation %.1f", mc.player.getFoodData().getSaturationLevel())));
		MODULES.add(text("reach", "Reach Display", "Distance of your last hit (Pro)", true, 0.5f, 0.6f,
			mc -> lastReach < 0 ? "Reach -" : String.format("Reach %.2f", lastReach), true));
		MODULES.add(text("combo", "Combo Counter", "Hits in a row without being hit (Pro)", true, 0.5f, 0.66f,
			mc -> combo + " Combo", true));
		MODULES.add(new TargetModule());
		MODULES.add(new PotionsModule());
		MODULES.add(new KeystrokesModule());
		MODULES.add(new ArmorModule());
		// PvP mode only.
		MODULES.add(pvpOnly(text("sprint", "Sprint Status", "Sprinting, sneaking or walking", false, 0.01f, 0.1f, HudManager::moveState)));
		MODULES.add(pvpOnly(text("health", "Health", "Hearts and absorption", false, 0.01f, 0.1f, mc -> mc.player == null
			? "20.0 HP" : String.format("%.1f HP", mc.player.getHealth() + mc.player.getAbsorptionAmount()))));
		MODULES.add(pvpOnly(new ItemsModule()));
		net.xion.client.feature.Pvp.setup();
	}

	private static HudModule pvpOnly(HudModule m) {
		m.pvpOnly = true;
		return m;
	}

	private static String moveState(Minecraft mc) {
		if (mc.player == null) return "Sprinting";
		if (mc.player.isSprinting()) return "Sprinting";
		return mc.player.isShiftKeyDown() ? "Sneaking" : "Walking";
	}

	private static TextModule text(String id, String name, String desc, boolean on, float x, float y, Function<Minecraft, String> f) {
		return new TextModule(id, name, desc, on, x, y, f, false);
	}

	private static TextModule text(String id, String name, String desc, boolean on, float x, float y, Function<Minecraft, String> f, boolean premium) {
		return new TextModule(id, name, desc, on, x, y, f, premium);
	}

	private static String direction(Minecraft mc) {
		if (mc.player == null) return "N 180°";
		float yaw = ((mc.player.getYRot() % 360) + 360) % 360;
		String[] dirs = {"S", "SW", "W", "NW", "N", "NE", "E", "SE"};
		return dirs[Math.round(yaw / 45f) % 8] + " " + Math.round(yaw) + "°";
	}

	// ---- combat tracking for the Pro modules ----
	private static double lastReach = -1;
	private static int combo;
	private static long lastHit;
	static net.minecraft.world.entity.LivingEntity target;
	private static long targetSeen;

	/** Left click with an entity under the crosshair counts as a hit. */
	private static void onAttack(Minecraft mc) {
		if (mc.player == null || Compat.screen() != null) return;
		if (!(mc.hitResult instanceof net.minecraft.world.phys.EntityHitResult hit)) return;
		lastReach = mc.player.getEyePosition().distanceTo(hit.getLocation());
		combo++;
		lastHit = System.currentTimeMillis();
		if (hit.getEntity() instanceof net.minecraft.world.entity.LivingEntity le) {
			target = le;
			targetSeen = lastHit;
		}
	}

	public static String pingText(Minecraft mc) {
		return ping(mc);
	}

	public static int fps() {
		return fps;
	}

	public static void registerClick(int button) {
		long now = System.currentTimeMillis();
		if (button == 0) {
			LEFT.add(now);
			onAttack(Minecraft.getInstance());
		}
		else if (button == 1) RIGHT.add(now);
	}

	private static int cps(Deque<Long> clicks) {
		long cutoff = System.currentTimeMillis() - 1000;
		while (!clicks.isEmpty() && clicks.peekFirst() < cutoff) clicks.pollFirst();
		return clicks.size();
	}

	private static String facing(Minecraft mc) {
		switch (mc.player.getDirection()) {
			case NORTH: return "N";
			case SOUTH: return "S";
			case EAST: return "E";
			case WEST: return "W";
			default: return "";
		}
	}

	private static long dayTime(Minecraft mc) {
		//#if MC >= 260000
		return mc.level.getOverworldClockTime();
		//#else
		return mc.level.getDayTime();
		//#endif
	}

	private static String ping(Minecraft mc) {
		if (mc.player == null || mc.getConnection() == null) return "24 ms";
		PlayerInfo info = mc.getConnection().getPlayerInfo(mc.player.getUUID());
		return (info == null ? 0 : info.getLatency()) + " ms";
	}

	/** Called every client tick. */
	public static void tick(Minecraft mc) {
		if (mc.player == null) {
			hasLast = false;
			return;
		}
		long now = System.currentTimeMillis();
		if (mc.player.hurtTime > 0 || now - lastHit > 2500) combo = 0;
		if (target != null && (now - targetSeen > 6000 || !target.isAlive())) target = null;
		double x = mc.player.getX(), z = mc.player.getZ();
		if (hasLast) {
			double d = Math.sqrt((x - lastX) * (x - lastX) + (z - lastZ) * (z - lastZ)) * 20;
			speed = speed * 0.6 + d * 0.4;
		}
		lastX = x;
		lastZ = z;
		hasLast = true;
	}

	public static void render(Gfx g, boolean preview) {
		Minecraft mc = g.mc;
		if (!preview) {
			frames++;
			long now = System.currentTimeMillis();
			if (now - fpsWindow >= 1000) {
				fps = frames;
				frames = 0;
				fpsWindow = now;
			}
		}
		int sw = g.width(), sh = g.height();
		for (HudModule m : MODULES) {
			if (!m.enabled()) continue;
			g.push();
			g.translate(m.x(sw, mc), m.y(sh, mc));
			if (m.scale() != 1f) g.scale(m.scale());
			m.render(g, mc, preview);
			g.pop();
		}
		if (!preview) net.xion.client.feature.Crosshair.render(g);
	}

	static void box(Gfx g, HudModule m, int w, int h) {
		if (!m.background()) return;
		if (net.xion.client.feature.Pvp.active()) {
			g.fill(0, 0, w, h, 0xB2100608);
			g.fill(0, 0, 2, h, Colors.ACCENT);
			return;
		}
		g.rounded(0, 0, w, h, 0x8A0B0A12);
		g.fill(0, 2, 1, h - 2, Colors.pulse(0.8f));
	}

	/** Lunar-style single line: dark box with centered text. */
	static final class TextModule extends HudModule {
		private final Function<Minecraft, String> text;

		TextModule(String id, String name, String desc, boolean on, float x, float y, Function<Minecraft, String> text, boolean premium) {
			super(id, name, desc, on, x, y, premium);
			this.text = text;
		}

		@Override
		public int width(Minecraft mc) {
			return Math.max(58, mc.font.width(text.apply(mc)) + 14);
		}

		@Override
		public int height(Minecraft mc) {
			return 15;
		}

		@Override
		public void render(Gfx g, Minecraft mc, boolean preview) {
			String s = text.apply(mc);
			int w = width(mc);
			box(g, this, w, 15);
			g.text(s, (w - mc.font.width(s)) / 2 + 1, 4, textColor(), !background());
		}
	}

	static final class PotionsModule extends HudModule {
		PotionsModule() {
			super("potions", "Potion Effects", "Active effects and time left", true, 1f, 0f);
		}

		private List<String> lines(Minecraft mc) {
			List<String> out = new ArrayList<>();
			if (mc.player != null) {
				for (MobEffectInstance e : mc.player.getActiveEffects()) {
					//#if MC >= 12005
					String name = e.getEffect().value().getDisplayName().getString();
					//#else
					String name = e.getEffect().getDisplayName().getString();
					//#endif
					int lvl = e.getAmplifier() + 1;
					int secs = e.getDuration() / 20;
					String time = e.getDuration() < 0 || secs > 3600 ? "∞" : String.format("%d:%02d", secs / 60, secs % 60);
					out.add(name + (lvl > 1 ? " " + lvl : "") + "  " + time);
				}
			}
			if (out.isEmpty() && mc.player == null) {
				out.add("Speed 2  1:30");
				out.add("Strength  0:45");
			}
			return out;
		}

		@Override
		public int width(Minecraft mc) {
			int w = 70;
			for (String l : lines(mc)) w = Math.max(w, mc.font.width(l) + 14);
			return w;
		}

		@Override
		public int height(Minecraft mc) {
			return Math.max(1, lines(mc).size()) * 13 + 2;
		}

		@Override
		public void render(Gfx g, Minecraft mc, boolean preview) {
			List<String> lines = lines(mc);
			if (lines.isEmpty()) return;
			box(g, this, width(mc), height(mc));
			for (int i = 0; i < lines.size(); i++) g.text(lines.get(i), 7, 4 + i * 13, textColor(), !background());
		}
	}

	static final class KeystrokesModule extends HudModule {
		KeystrokesModule() {
			super("keystrokes", "Keystrokes", "WASD, mouse and jump keys", true, 1f, 1f);
		}

		@Override
		public int width(Minecraft mc) {
			return 64;
		}

		@Override
		public int height(Minecraft mc) {
			return 78;
		}

		@Override
		public void render(Gfx g, Minecraft mc, boolean preview) {
			var o = mc.options;
			key(g, 22, 0, 20, 20, "W", o.keyUp);
			key(g, 0, 22, 20, 20, "A", o.keyLeft);
			key(g, 22, 22, 20, 20, "S", o.keyDown);
			key(g, 44, 22, 20, 20, "D", o.keyRight);
			if (net.xion.client.feature.Pvp.active()) {
				mouseKey(g, 0, 44, "LMB", cps(LEFT), o.keyAttack);
				mouseKey(g, 33, 44, "RMB", cps(RIGHT), o.keyUse);
			} else {
				key(g, 0, 44, 31, 20, "LMB", o.keyAttack);
				key(g, 33, 44, 31, 20, "RMB", o.keyUse);
			}
			boolean jump = o.keyJump.isDown();
			g.rounded(0, 66, 64, 12, jump ? 0xE6FFFFFF : 0x8A0B0A12);
			g.fill(22, 71, 42, 72, jump ? 0xFF101018 : Colors.TEXT);
		}

		/** PvP: a mouse key with its live clicks per second underneath. */
		private static void mouseKey(Gfx g, int x, int y, String label, int cps, KeyMapping km) {
			boolean down = km.isDown();
			g.fill(x, y, x + 31, y + 20, down ? 0xF2FFFFFF : 0xB2100608);
			g.fill(x, y, x + 31, y + 1, down ? Colors.ACCENT : Colors.alpha(Colors.ACCENT, 0.55f));
			int fg = down ? 0xFF1A0709 : Colors.TEXT;
			g.text(label, x + (31 - g.font.width(label)) / 2, y + 3, fg, false);
			String n = String.valueOf(cps);
			g.text(n, x + (31 - g.font.width(n)) / 2, y + 11, down ? 0xFF1A0709 : Colors.ACCENT, false);
		}

		private static void key(Gfx g, int x, int y, int w, int h, String label, KeyMapping km) {
			boolean down = km.isDown();
			g.rounded(x, y, w, h, down ? 0xE6FFFFFF : 0x8A0B0A12);
			if (down) g.outline(x, y, w, h, Colors.ACCENT);
			g.text(label, x + (w - g.font.width(label)) / 2, y + (h - 8) / 2, down ? 0xFF101018 : Colors.TEXT, false);
		}
	}

	/** Pro: name, health bar and distance of the entity you last hit. */
	static final class TargetModule extends HudModule {
		TargetModule() {
			super("target", "Target HUD", "Health of the mob or player you are fighting (Pro)", true, 0.5f, 0.72f, true);
		}

		@Override
		public int width(Minecraft mc) {
			return 120;
		}

		@Override
		public int height(Minecraft mc) {
			return 32;
		}

		@Override
		public void render(Gfx g, Minecraft mc, boolean preview) {
			net.minecraft.world.entity.LivingEntity t = target;
			if (t == null && !preview) return;
			String name = t == null ? "Zombie" : t.getName().getString();
			float hp = t == null ? 14 : t.getHealth(), max = t == null ? 20 : Math.max(1, t.getMaxHealth());
			float pct = Math.max(0, Math.min(1, hp / max));
			g.rounded(0, 0, 120, 32, net.xion.client.feature.Pvp.active() ? 0xCC100608 : 0xC00B0A12);
			g.fill(0, net.xion.client.feature.Pvp.active() ? 0 : 3, net.xion.client.feature.Pvp.active() ? 2 : 1, net.xion.client.feature.Pvp.active() ? 32 : 29, Colors.pulse(0.8f));
			g.text(g.font.plainSubstrByWidth(name, 104), 7, 5, textColor(), false);
			String hpText = String.format("%.1f / %.0f", hp, max);
			g.text(hpText, 113 - g.font.width(hpText), 5, Colors.MUTED, false);
			g.rounded(7, 19, 106, 7, 0xFF20242E);
			int col = pct > 0.5f ? 0xFF6EE7A8 : pct > 0.25f ? 0xFFFFD166 : 0xFFFF5D73;
			if (pct > 0) g.rounded(7, 19, Math.max(2, Math.round(106 * pct)), 7, col);
		}
	}

	/** PvP: how many totems, golden apples and ender pearls you carry. */
	static final class ItemsModule extends HudModule {
		private static final String[] NAMES = {"Totem", "Gapple", "Pearl"};

		ItemsModule() {
			super("items", "Item Counter", "Totems, golden apples and ender pearls", false, 0.01f, 0.26f);
		}

		@Override
		public int width(Minecraft mc) {
			return 60;
		}

		@Override
		public int height(Minecraft mc) {
			return NAMES.length * 17;
		}

		private static int count(Minecraft mc, int kind) {
			if (mc.player == null) return 0;
			var inv = mc.player.getInventory();
			int n = 0;
			for (int i = 0; i < inv.getContainerSize(); i++) {
				ItemStack s = inv.getItem(i);
				if (s.isEmpty()) continue;
				boolean hit = kind == 0 ? s.is(Items.TOTEM_OF_UNDYING)
					: kind == 1 ? s.is(Items.GOLDEN_APPLE) || s.is(Items.ENCHANTED_GOLDEN_APPLE)
					: s.is(Items.ENDER_PEARL);
				if (hit) n += s.getCount();
			}
			return n;
		}

		@Override
		public void render(Gfx g, Minecraft mc, boolean preview) {
			for (int i = 0; i < NAMES.length; i++) {
				int y = i * 17;
				g.push();
				g.translate(0, y);
				box(g, this, 56, 16);
				g.pop();
				if (mc.level == null) {
					g.text(NAMES[i], 19, y + 4, Colors.MUTED, true);
					continue;
				}
				int n = count(mc, i);
				g.item(new ItemStack(i == 0 ? Items.TOTEM_OF_UNDYING : i == 1 ? Items.GOLDEN_APPLE : Items.ENDER_PEARL), 0, y);
				g.text(String.valueOf(preview && n == 0 ? 3 - i : n), 19, y + 4, n == 0 && !preview ? Colors.MUTED : textColor(), true);
			}
		}
	}

	static final class ArmorModule extends HudModule {
		private static final EquipmentSlot[] SLOTS = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND};

		ArmorModule() {
			super("armor", "Armor Status", "Armor and held item durability", true, 1f, 0.22f);
		}

		@Override
		public int width(Minecraft mc) {
			return 52;
		}

		@Override
		public int height(Minecraft mc) {
			return SLOTS.length * 17;
		}

		@Override
		public void render(Gfx g, Minecraft mc, boolean preview) {
			if (mc.level == null) {
				// Item components aren't usable outside a world, so draw a placeholder layout.
				String[] labels = {"Helmet", "Chest", "Legs", "Boots", "Hand"};
				for (int i = 0; i < SLOTS.length; i++) {
					g.rounded(0, i * 17, 16, 16, 0x8A0B0A12);
					g.text(labels[i], 19, i * 17 + 4, Colors.MUTED, true);
				}
				return;
			}
			for (int i = 0; i < SLOTS.length; i++) {
				ItemStack stack = mc.player != null ? mc.player.getItemBySlot(SLOTS[i]) : ItemStack.EMPTY;
				if (preview && stack.isEmpty()) stack = new ItemStack(i == 0 ? Items.DIAMOND_HELMET : i == 1 ? Items.DIAMOND_CHESTPLATE
					: i == 2 ? Items.DIAMOND_LEGGINGS : i == 3 ? Items.DIAMOND_BOOTS : Items.DIAMOND_SWORD);
				if (stack.isEmpty()) continue;
				int y = i * 17;
				g.item(stack, 0, y);
				if (stack.isDamageableItem()) {
					int left = stack.getMaxDamage() - stack.getDamageValue();
					float pct = left / (float) stack.getMaxDamage();
					int color = pct > 0.5f ? 0xFF7CF29A : pct > 0.2f ? 0xFFFFD166 : 0xFFFF5D73;
					g.text(String.valueOf(left), 19, y + 4, color, true);
				} else if (stack.getCount() > 1) {
					g.text(String.valueOf(stack.getCount()), 19, y + 4, Colors.TEXT, true);
				}
			}
		}
	}
}
