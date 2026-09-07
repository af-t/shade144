export const PACKAGES = [
  { packageName: 'com.android.settings', appLabel: 'Settings', isSystem: true, uid: 1000 },
  { packageName: 'com.android.systemui', appLabel: 'System UI', isSystem: true, uid: 1001 },
  { packageName: 'com.android.launcher3', appLabel: 'Launcher', isSystem: true, uid: 1002 },
  { packageName: 'com.android.dialer', appLabel: 'Phone', isSystem: true, uid: 1003 },
  { packageName: 'com.android.contacts', appLabel: 'Contacts', isSystem: true, uid: 1004 },
  { packageName: 'com.android.messaging', appLabel: 'Messages', isSystem: true, uid: 1005 },
  { packageName: 'com.android.camera2', appLabel: 'Camera', isSystem: true, uid: 1006 },
  { packageName: 'com.android.gallery3d', appLabel: 'Gallery', isSystem: true, uid: 1007 },
  { packageName: 'com.android.calculator2', appLabel: 'Calculator', isSystem: true, uid: 1008 },
  { packageName: 'com.android.deskclock', appLabel: 'Clock', isSystem: true, uid: 1009 },
  { packageName: 'com.android.calendar', appLabel: 'Calendar', isSystem: true, uid: 1010 },
  { packageName: 'com.android.chrome', appLabel: 'Chrome', isSystem: false, uid: 10111 },
  { packageName: 'com.google.android.youtube', appLabel: 'YouTube', isSystem: false, uid: 10112 },
  {
    packageName: 'com.google.android.gms',
    appLabel: 'Google Play Services',
    isSystem: true,
    uid: 10013,
  },
  { packageName: 'com.google.android.gm', appLabel: 'Gmail', isSystem: false, uid: 10114 },
  {
    packageName: 'com.google.android.apps.messaging',
    appLabel: 'Messages (Google)',
    isSystem: false,
    uid: 10115,
  },
  {
    packageName: 'com.google.android.googlequicksearchbox',
    appLabel: 'Google',
    isSystem: true,
    uid: 10016,
  },
  {
    packageName: 'com.google.android.apps.photos',
    appLabel: 'Photos',
    isSystem: false,
    uid: 10117,
  },
  { packageName: 'com.google.android.maps', appLabel: 'Maps', isSystem: false, uid: 10118 },
  { packageName: 'com.tencent.mm', appLabel: 'WeChat', isSystem: false, uid: 10119 },
  { packageName: 'com.tencent.mobileqq', appLabel: 'QQ', isSystem: false, uid: 10120 },
  { packageName: 'com.taobao.taobao', appLabel: 'Taobao', isSystem: false, uid: 10121 },
  { packageName: 'com.eg.android.AlipayGphone', appLabel: 'Alipay', isSystem: false, uid: 10122 },
  { packageName: 'com.discord', appLabel: 'Discord', isSystem: false, uid: 10123 },
  { packageName: 'com.reddit.frontpage', appLabel: 'Reddit', isSystem: false, uid: 10124 },
  { packageName: 'com.twitter.android', appLabel: 'X (Twitter)', isSystem: false, uid: 10125 },
  { packageName: 'com.instagram.android', appLabel: 'Instagram', isSystem: false, uid: 10126 },
  { packageName: 'com.facebook.katana', appLabel: 'Facebook', isSystem: false, uid: 10127 },
  { packageName: 'org.telegram.messenger', appLabel: 'Telegram', isSystem: false, uid: 10128 },
  { packageName: 'com.whatsapp', appLabel: 'WhatsApp', isSystem: false, uid: 10129 },
  { packageName: 'com.snapchat.android', appLabel: 'Snapchat', isSystem: false, uid: 10130 },
  { packageName: 'com.spotify.music', appLabel: 'Spotify', isSystem: false, uid: 10131 },
  { packageName: 'netflix.mediaclient', appLabel: 'Netflix', isSystem: false, uid: 10132 },
  { packageName: 'com.shopee.id', appLabel: 'Shopee', isSystem: false, uid: 10133 },
  { packageName: 'com.lazada.android', appLabel: 'Lazada', isSystem: false, uid: 10134 },
  { packageName: 'com.einnovation.temu', appLabel: 'Temu', isSystem: false, uid: 10135 },
  { packageName: 'com.bytedance.tiktok', appLabel: 'TikTok', isSystem: false, uid: 10136 },
  { packageName: 'com.transsion.launcher3', appLabel: 'XOS Launcher', isSystem: true, uid: 10037 },
  {
    packageName: 'com.transsion.XOSLauncher',
    appLabel: 'XOS Launcher (Home)',
    isSystem: true,
    uid: 10038,
  },
  {
    packageName: 'com.transsion.personalizedService.xos',
    appLabel: 'Personalized Service',
    isSystem: true,
    uid: 10039,
  },
  {
    packageName: 'com.transsion.systemupdate',
    appLabel: 'System Update',
    isSystem: true,
    uid: 10040,
  },
  {
    packageName: 'com.transsion.wallet.infinix',
    appLabel: 'Infinix Wallet',
    isSystem: true,
    uid: 10041,
  },
  { packageName: 'com.termux', appLabel: 'Termux', isSystem: false, uid: 10142 },
  {
    packageName: 'app.revanced.android.youtube',
    appLabel: 'YouTube ReVanced',
    isSystem: false,
    uid: 10143,
  },
  { packageName: 'org.mozilla.firefox', appLabel: 'Firefox', isSystem: false, uid: 10144 },
  { packageName: 'com.opera.mini.native', appLabel: 'Opera Mini', isSystem: false, uid: 10145 },
];

export const DEFAULT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<refresh_rate_config version="20260727">
    <switch>
        <input_method_switch>true</input_method_switch>
        <navigation_switch>true</navigation_switch>
        <video_switch>true</video_switch>
        <audio_switch>true</audio_switch>
        <high_temperature_threshold>0</high_temperature_threshold>
        <multi_window_refresh_rate>120</multi_window_refresh_rate>
        <screen_record>120</screen_record>
    </switch>
    <WHITELIST>
        <item package="com.android.settings" auto="90" high="90" max="144" touch="1" app_request="0"></item>
        <item package="com.android.systemui" auto="120" high="120" max="144" touch="1" app_request="0"></item>
        <item package="com.tencent.mm" auto="90" high="90" max="144" touch="1" app_request="0"></item>
        <item package="org.telegram.messenger" auto="90" high="90" max="144" touch="1" app_request="1"></item>
        <item package="com.eg.android.AlipayGphone" auto="90" high="90" max="144" touch="1" app_request="1"></item>
        <item package="com.google.android.youtube" auto="60" high="90" max="144" touch="0" app_request="0"></item>
        <item package="com.transsion.launcher3" auto="120" high="120" max="144" touch="1" app_request="0"></item>
        <item package="com.removed.app" auto="90" high="90" max="144" touch="1" app_request="0"></item>
        <item package="com.notinstalled.here" auto="60" high="60" max="144" touch="0" app_request="0"></item>
    </WHITELIST>
</refresh_rate_config>`;

export const STORAGE_KEY = 'shade144.mock.xml';
export const CONFIG_MARKER = 'refresh_rate_config.xml';
