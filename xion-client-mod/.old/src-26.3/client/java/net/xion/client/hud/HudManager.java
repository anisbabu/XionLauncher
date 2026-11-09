package net.xion.client.hud;

import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.xion.client.XionConfig;
import net.xion.client.gui.Draw;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.function.Function;

public final class HudManager {
	public static final List<HudModule> MODULES = new ArrayList<>();
	private static final Deque<Long> LEFT_CLICKS = new ArrayDeque<>();
	private static final Deque<Long> RIGHT_CLICKS = new ArrayDeque<>();
	private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");

	private HudManager() {}

	public static void init() {
		MODULES.add(new TextModule("fps", "FPS", "Frames per second", true, 0.01f, 0.02f,
			(mc) -> mc.getFps() + " FPS"));
		MODULES.add(new TextModule("cps", "CPS", "Clicks per second", true, 0.01f, 0.09f,
			(mc) -> cps(LEFT_CLICKS) + " | " + cps(RIGHT_CLICKS) + " CPS"));
		MODULES.add(new TextModule("coords", "Coordinates", "Your position and facing", true, 0.01f, 0.16f,
			(mc) -> mc.player == null ? "X 128  Y 64  Z -32  N"
				: String.format("X %d  Y %d  Z %d  %s", mc.player.getBlockX(), mc.player.getBlockY(), mc.player.getBlockZ(), facing(mc))));
		MODULES.add(new TextModule("ping", "Ping", "Latency to the server", true, 0.01f, 0.23f, HudManager::ping));
		MODULES.add(new TextModule("clock", "Clock", "Real-world time", false, 0.01f, 0.30f,
			(mc) -> LocalTime.now().format(CLOCK)));
		MODULES.add(new TextModule("memory", "Memory", "Java memory usage", false, 0.01f, 0.37f, (mc) -> {
			Runtime rt = Runtime.getRuntime();
			long used = (rt.totalMemory() - rt.freeMemory()) / 1048576;
			return "MEM " + used * 100 / Math.max(1, rt.maxMemory() / 1048576) + "%";
		}));
		MODULES.add(new TextModule("server", "Server", "Current server address", false, 0.01f, 0.44f, (mc) -> {
			ServerData s = mc.getCurrentServer();
			return s != null ? s.ip : (mc.getSingleplayerServer() != null ? "Singleplayer" : "play.example.net");
		}));
		MODULES.add(new KeystrokesModule());
		MODULES.add(new ArmorModule());
	}

	public static void registerClick(int button) {
		long now = System.currentTimeMillis();
		if (button == 0) LEFT_CLICKS.add(now);
		else if (button == 1) RIGHT_CLICKS.add(now);
	}

	private static int cps(Deque<Long> clicks) {
		long cutoff = System.currentTimeMillis() - 1000;
		while (!clicks.isEmpty() && clicks.peekFirst() < cutoff) clicks.pollFirst();
		return clicks.size();
	}

	private static String facing(Minecraft mc) {
		return switch (mc.player.getDirection()) {
			case NORTH -> "N";
			case SOUTH -> "S";
			case EAST -> "E";
			case WEST -> "W";
			default -> "";
		};
	}

	private static String ping(Minecraft mc) {
		if (mc.player == null || mc.getConnection() == null) return "24 ms";
		PlayerInfo info = mc.getConnection().getPlayerInfo(mc.player.getUUID());
		return (info == null ? 0 : info.getLatency()) + " ms";
	}

	public static void render(GuiGraphicsExtractor g, boolean preview) {
		Minecraft mc = Minecraft.getInstance();
		if (!preview && (mc.gui.hud.isHidden() || mc.debugEntries.isOverlayVisible())) return;
		int sw = g.guiWidth();
		int sh = g.guiHeight();
		for (HudModule m : MODULES) {
			if (!m.enabled()) continue;
			g.pose().pushMatrix();
			g.pose().translate(m.x(sw, mc), m.y(sh, mc));
			m.render(g, mc, preview);
			g.pose().popMatrix();
		}
	}

	/** Lunar-style single line: dark box with centered text. */
	static final class TextModule extends HudModule {
		private final Function<Minecraft, String> text;

		TextModule(String id, String name, String desc, boolean on, float x, float y, Function<Minecraft, String> text) {
			super(id, name, desc, on, x, y);
			this.text = text;
		}

		@Override
		public int width(Minecraft mc) {
			return Math.max(56, mc.font.width(text.apply(mc)) + 12);
		}

		@Override
		public int height(Minecraft mc) {
			return 15;
		}

		@Override
		public void render(GuiGraphicsExtractor g, Minecraft mc, boolean preview) {
			String s = text.apply(mc);
			int w = width(mc);
			if (XionConfig.data.hudBackground) {
				Draw.rounded(g, 0, 0, w, 15, 0x70000000);
				g.fill(0, 3, 1, 12, Draw.ACCENT);
			}
			g.text(mc.font, s, (w - mc.font.width(s)) / 2, 4, Draw.TEXT, !XionConfig.data.hudBackground);
		}
	}

	static final class KeystrokesModule extends HudModule {
		KeystrokesModule() {
			super("keystrokes", "Keystrokes", "WASD, mouse and jump keys", true, 0.86f, 0.62f);
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
		public void render(GuiGraphicsExtractor g, Minecraft mc, boolean preview) {
			var o = mc.options;
			key(g, mc, 22, 0, 20, 20, "W", o.keyUp);
			key(g, mc, 0, 22, 20, 20, "A", o.keyLeft);
			key(g, mc, 22, 22, 20, 20, "S", o.keyDown);
			key(g, mc, 44, 22, 20, 20, "D", o.keyRight);
			key(g, mc, 0, 44, 31, 20, "LMB", o.keyAttack);
			key(g, mc, 33, 44, 31, 20, "RMB", o.keyUse);
			boolean jump = o.keyJump.isDown();
			Draw.rounded(g, 0, 66, 64, 12, jump ? 0xD0FFFFFF : 0x70000000);
			g.fill(22, 71, 42, 72, jump ? 0xFF101018 : Draw.TEXT);
		}

		private static void key(GuiGraphicsExtractor g, Minecraft mc, int x, int y, int w, int h, String label, KeyMapping km) {
			boolean down = km.isDown();
			Draw.rounded(g, x, y, w, h, down ? 0xD0FFFFFF : 0x70000000);
			g.text(mc.font, label, x + (w - mc.font.width(label)) / 2, y + (h - 8) / 2, down ? 0xFF101018 : Draw.TEXT, false);
		}
	}

	static final class ArmorModule extends HudModule {
		private static final EquipmentSlot[] SLOTS = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND};

		ArmorModule() {
			super("armor", "Armor Status", "Armor and held item durability", true, 0.88f, 0.30f);
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
		public void render(GuiGraphicsExtractor g, Minecraft mc, boolean preview) {
			if (mc.level == null) {
				// Item components aren't bound outside a world, so draw a placeholder layout.
				String[] labels = {"Helmet", "Chest", "Legs", "Boots", "Hand"};
				for (int i = 0; i < SLOTS.length; i++) {
					Draw.rounded(g, 0, i * 17, 16, 16, 0x70000000);
					g.text(mc.font, labels[i], 19, i * 17 + 4, Draw.MUTED, true);
				}
				return;
			}
			for (int i = 0; i < SLOTS.length; i++) {
				ItemStack stack = mc.player != null ? mc.player.getItemBySlot(SLOTS[i]) : ItemStack.EMPTY;
				if (preview && stack.isEmpty()) stack = new ItemStack(switch (i) {
					case 0 -> Items.DIAMOND_HELMET;
					case 1 -> Items.DIAMOND_CHESTPLATE;
					case 2 -> Items.DIAMOND_LEGGINGS;
					case 3 -> Items.DIAMOND_BOOTS;
					default -> Items.DIAMOND_SWORD;
				});
				if (stack.isEmpty()) continue;
				int y = i * 17;
				g.item(stack, 0, y);
				if (stack.isDamageableItem()) {
					int left = stack.getMaxDamage() - stack.getDamageValue();
					float pct = left / (float) stack.getMaxDamage();
					int color = pct > 0.5f ? 0xFF7CF29A : pct > 0.2f ? 0xFFFFD166 : 0xFFFF5D73;
					g.text(mc.font, String.valueOf(left), 19, y + 4, color, true);
				} else if (stack.getCount() > 1) {
					g.text(mc.font, String.valueOf(stack.getCount()), 19, y + 4, Draw.TEXT, true);
				}
			}
		}
	}
}
