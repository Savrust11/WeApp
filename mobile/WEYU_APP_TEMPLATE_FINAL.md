# We育（ウィーク）モバイルアプリ 最終テンプレート仕様書

**作成日：** 2026年4月9日
**プロジェクト名：** We育 — パートナーと一緒に育児を楽しもう
**プラットフォーム：** iOS / Android / Web
**バージョン：** 1.0.0

---

## 1. プロジェクト概要

We育は、パートナーと一緒に育児を楽しく・効率的に行うための子育て支援アプリです。
日々の育児記録、健康管理、睡眠トレーニング、食品管理、ゲーミフィケーション（ポイント＆クーポン）など、幅広い機能を備えています。

---

## 2. 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | Expo SDK 55 / React Native 0.83 |
| 言語 | TypeScript 5.9 |
| 状態管理 | Zustand 5.0 |
| データ取得 | TanStack React Query 5.95 |
| フォーム | React Hook Form 7.72 + Zod 4.3 |
| ナビゲーション | React Navigation 7 (Stack + Bottom Tabs) |
| 多言語対応 | i18next（日本語・英語） |
| バックエンド | Express 5 + PostgreSQL (Neon) |
| ORM | Drizzle ORM |
| 認証 | LINE / Google / Apple / ゲスト |
| 通知 | expo-notifications |
| アニメーション | React Native Reanimated 4.2 |
| ビルド | EAS Build / EAS Submit |

---

## 3. 実装済み画面一覧（全15画面）

### メインタブ（5画面）

| 画面名 | ファイル | 機能概要 |
|--------|---------|---------|
| ホーム | `HomeScreen.tsx` | 今日のサマリー、ワンタップ記録（12種類）、子ども切り替え、最新5件表示 |
| カレンダー | `CalendarScreen.tsx` | 月別カレンダー、日ごとの記録ドット表示、日選択で記録一覧 |
| タイムライン | `TimelineScreen.tsx` | 全記録を時系列で一覧表示、色分け、ポイント表示 |
| ショップ | `ShopScreen.tsx` | ポイント交換、ごほうびクーポン管理、カスタムクーポン作成 |
| 設定 | `SettingsScreen.tsx` | プロフィール、子ども管理、各機能へのメニュー、ログアウト |

### サブ画面（10画面）

| 画面名 | ファイル | 機能概要 |
|--------|---------|---------|
| ログイン | `LoginScreen.tsx` | LINE / Google / Apple / ゲストログイン |
| オンボーディング | `OnboardingScreen.tsx` | 3ステップ初回登録（役割→名前→子ども情報） |
| 健康記録 | `HealthScreen.tsx` | 成長記録・予防接種・健康管理（3タブ構成） |
| 睡眠トレーニング | `SleepTrainingScreen.tsx` | 睡眠タイマー・環境チェックリスト・ルーティン管理 |
| 食品トラッカー | `FoodTrackerScreen.tsx` | 離乳食の食材管理・アレルギー追跡 |
| 子どもプロフィール | `ChildProfileScreen.tsx` | 子どもの詳細情報（名前・生年月日・性別）編集 |
| パートナー招待 | `InvitationScreen.tsx` | 招待コード発行・入力による家族連携 |
| 授乳アラーム | `AlarmScreen.tsx` | 授乳リマインダー設定（間隔・サウンド・有効無効） |
| ぴよログ移行 | `ImportScreen.tsx` | ぴよログデータの貼り付け→プレビュー→インポート |
| 音声ショートカット | `ShortcutsScreen.tsx` | Siri / Google Assistant連携、ディープリンク設定 |

---

## 4. ワンタップ記録機能（12種類）

| 記録タイプ | ラベル | 詳細入力 |
|-----------|--------|---------|
| 母乳 | 母乳 | 左右の授乳時間（分） |
| ミルク | ミルク | 量（mL） |
| おしっこ | おしっこ | ワンタップ |
| うんち | うんち | ワンタップ |
| 睡眠 | 睡眠 | ワンタップ |
| お風呂 | お風呂 | ワンタップ |
| 薬 | 薬 | 薬名・用量 |
| 体温 | 体温 | 体温（°C） |
| 離乳食 | 離乳食 | ワンタップ |
| 成長記録 | 成長記録 | 健康画面へ遷移 |
| 症状 | 症状 | 症状選択（6種類）・メモ |
| 搾乳 | 搾乳 | 量（mL） |

**症状選択肢：** 発熱、咳・鼻水、湿疹、下痢・便秘、吐き戻し、機嫌が悪い

---

## 5. 認証システム

### LINE ログイン — 実装済み
- サーバーサイドリダイレクトフロー
- Web / ネイティブ両対応
- ディープリンク（`weyu://auth/callback`）でアプリに戻る

### Google ログイン — 実装済み
- **Web版：** ブラウザリダイレクトフロー（COOP問題を回避）
- **ネイティブ版：** サーバーサイドリダイレクトフロー
- Google Cloud Console クライアントID設定済み

### Apple ログイン — 実装済み
- iOS専用のネイティブ認証（expo-apple-authentication）
- identityToken による検証

### ゲストログイン — 実装済み
- アカウント不要でオンボーディングへ進む
- ゲスト用家族ID自動生成

---

## 6. 家族コラボレーション機能

| 機能 | 詳細 |
|------|------|
| マルチユーザー | パパ・ママ・その他の役割選択 |
| 招待コード | コード発行→パートナーが入力で家族連携 |
| 共有ログ | 家族全員の記録を共有表示 |
| 複数の子ども | 子ども切り替えで個別管理 |

---

## 7. 健康・成長管理（3タブ構成）

### 成長タブ
- 体重（kg）、身長（cm）、頭囲（cm）の記録
- 最新値の表示、履歴管理

### 予防接種タブ
- ワクチン名・接種日の記録
- メモ欄、削除機能

### 健康記録タブ
- タイプ選択：アレルギー / 既往歴 / 健康メモ
- タイトル・詳細・日付の記録

---

## 8. 睡眠トレーニング

| 機能 | 詳細 |
|------|------|
| 睡眠タイマー | 開始/停止ボタン、リアルタイム経過表示 |
| 環境チェックリスト | 暗い部屋、適切な室温、安全な環境、ホワイトノイズ |
| ルーティン管理 | 担当者表示付きルーティン |
| ダークテーマUI | 夜間使用に配慮したデザイン |

---

## 9. ゲーミフィケーション（ポイント＆クーポン）

| 機能 | 詳細 |
|------|------|
| ポイント獲得 | 育児記録のたびにポイント付与 |
| クーポン交換 | ポイントでごほうびクーポンを獲得 |
| カスタムクーポン | オリジナルのごほうびを作成可能 |
| 利用履歴 | 使用済みクーポンの確認 |

---

## 10. 授乳アラーム機能

| 設定項目 | 詳細 |
|----------|------|
| 有効/無効 | トグルで切り替え |
| 間隔選択 | 2時間 / 2.5時間 / **3時間（推奨）** / 3.5時間 / 4時間 |
| サウンド | ON/OFF 切り替え |
| 次回アラーム | 時刻表示 |
| 自動スケジュール | 授乳記録時に自動で次回アラーム設定 |
| 通知形式 | OSローカル通知（アプリ閉じても動作） |

---

## 11. ぴよログデータ移行

| ステップ | 詳細 |
|----------|------|
| Step 1 | ぴよログのテキストエクスポートを貼り付け |
| Step 2 | プレビュー確認（件数・スキップ・エラー表示、先頭20件表示） |
| Step 3 | インポート実行、完了サマリー表示 |

- ドライラン（プレビュー）とインポートの2段階
- ぴよログカテゴリ → We育ログタイプへの自動マッピング
- タイムスタンプ・詳細情報の保持

---

## 12. 音声アシスタント連携

### 対応ディープリンク

| コマンド | URL | 動作 |
|---------|-----|------|
| 母乳を記録 | `weyu://log/breastfeed` | 母乳記録を作成 |
| ミルクを記録 | `weyu://log/formula` | ミルク記録を作成 |
| おしっこを記録 | `weyu://log/diaper_wet` | おしっこ記録を作成 |
| うんちを記録 | `weyu://log/diaper_poop` | うんち記録を作成 |
| 睡眠を記録 | `weyu://log/sleep` | 睡眠記録を作成 |
| 今の状態を確認 | `weyu://status` | ステータス確認 |

### プラットフォーム別設定
- **iOS:** Siri ショートカット連携
- **Android:** Google Assistant App Actions
- **Phase 2予定:** Amazon Alexa対応

---

## 13. ホーム画面ウィジェット（実装予定）

### ウィジェットデータ構造（widgetCache.ts 実装済み）

| データ項目 | 内容 |
|-----------|------|
| 最終授乳 | 時刻・タイプ（母乳/ミルク/搾乳）・量/時間 |
| 最終おむつ | 時刻・タイプ（おしっこ/うんち） |
| 睡眠状態 | sleeping / awake / unknown |
| 今日の回数 | 授乳・おむつ・睡眠の各回数 |
| 子どもの名前 | アクティブな子ども |

### ウィジェットサイズ別表示

| サイズ | 表示内容 |
|--------|---------|
| Small | 最終授乳 + 経過時間 |
| Medium | 最終授乳 + おむつ + 睡眠状態 |
| Large | Medium + 今日の回数 |
| ロック画面 | 最終授乳のみ |

### 実装に必要なネイティブ作業
- **iOS:** WidgetKit (Swift) + App Groups
- **Android:** Glance API (Jetpack Compose) + SharedPreferences
- Expo prebuildでBare化が必要

---

## 14. データベース構成（22テーブル）

### ユーザー・認証
- `users` — ユーザーアカウント
- `invitation_codes` — 家族招待コード

### 子ども・家族
- `children` — 子どもプロフィール
- `settings` — 家族設定

### 育児記録
- `logs` — 活動記録（12種類すべて）
- `events` — 家族イベント・タスク
- `notifications` — 通知

### 健康・成長
- `health_records` — 健康記録
- `growth_records` — 成長記録（体重・身長・頭囲）
- `vaccination_records` — 予防接種記録
- `custom_vaccines` — カスタム予防接種
- `food_ingredients` — 食材追跡（アレルギー対応）

### 睡眠管理
- `sleep_checklist` — 睡眠環境チェックリスト
- `sleep_routines` — 睡眠ルーティン
- `sleep_routine_logs` — ルーティン完了記録
- `sleep_sessions` — 睡眠セッション

### ゲーミフィケーション
- `coupons` — ごほうびクーポン
- `user_coupons` — クーポン所有・利用
- `skill_completions` — スキル達成記録

### ユーザーコンテンツ
- `feedbacks` — フィードバック
- `we_board` — 家族掲示板
- `custom_childcare_items` — カスタム育児アイテム

---

## 15. API エンドポイント一覧

### 認証 API
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/auth/me` | 現在のユーザー取得 |
| POST | `/api/auth/verify-code` | 招待コード検証 |
| POST | `/api/auth/update-role` | 役割更新 |
| POST | `/api/auth/join-family` | 家族に参加 |
| POST | `/api/auth/mobile/logout` | ログアウト |
| GET | `/api/auth/line?mobile=true` | LINE OAuth |
| POST | `/api/auth/google` | Google OAuth |
| POST | `/api/auth/apple` | Apple認証 |
| POST | `/api/auth/push-token` | プッシュトークン登録 |
| POST | `/api/auth/generate-invite` | 招待コード生成 |
| GET | `/api/auth/google/native` | ネイティブGoogle認証 |

### 育児記録 API
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/logs/{familyId}` | 家族のログ取得 |
| POST | `/api/logs` | ログ作成 |
| POST | `/api/logs/{id}/update` | ログ更新 |
| DELETE | `/api/logs/{id}` | ログ削除 |

### 子ども管理 API
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/children/{familyId}` | 子ども一覧取得 |
| POST | `/api/children` | 子ども作成 |
| POST | `/api/children/{id}` | 子ども更新 |
| DELETE | `/api/children/{id}` | 子ども削除 |

### 健康 API
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/growth/{familyId}` | 成長記録取得 |
| POST | `/api/growth` | 成長記録作成 |
| DELETE | `/api/growth/{id}` | 成長記録削除 |
| GET | `/api/vaccination-records/{familyId}` | 予防接種取得 |
| POST | `/api/vaccination-records` | 予防接種作成 |
| DELETE | `/api/vaccination-records/{id}` | 予防接種削除 |
| GET | `/api/health-records/{familyId}` | 健康記録取得 |
| POST | `/api/health-records` | 健康記録作成 |
| DELETE | `/api/health-records/{id}` | 健康記録削除 |

### 睡眠 API
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/sleep-sessions/{familyId}/active` | アクティブセッション取得 |
| POST | `/api/sleep-sessions/start` | 睡眠開始 |
| POST | `/api/sleep-sessions/{id}/end` | 睡眠終了 |
| GET | `/api/sleep/routines/{familyId}` | ルーティン取得 |
| GET | `/api/sleep/checklist/{familyId}/{date}` | チェックリスト取得 |
| POST | `/api/sleep/checklist` | チェックリスト保存 |

### ショップ API
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/coupons/{familyId}` | クーポン一覧 |
| POST | `/api/coupons` | カスタムクーポン作成 |
| DELETE | `/api/coupons/{id}` | クーポン削除 |
| GET | `/api/user-coupons/{familyId}` | 所有クーポン |
| POST | `/api/coupons/exchange` | ポイント交換 |
| POST | `/api/user-coupons/{id}/redeem` | クーポン使用 |

### データ移行 API
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | `/api/import/piyolog` | ぴよログインポート（dryRunパラメータ対応） |

---

## 16. 開発環境構成

### ローカル開発
| サーバー | ポート | 役割 |
|---------|--------|------|
| Express（バックエンド） | 5000 | API サーバー |
| Expo（モバイルWeb） | 8082 | フロントエンド開発サーバー |
| 開発プロキシ | 8081 | API→Express、その他→Expo 振り分け |

### 外部アクセス（ngrok）
- ngrok → ポート 8081（開発プロキシ経由）
- `/api` リクエスト → Express
- その他 → Expo
- OAuth テスト用

### ビルドプロファイル（eas.json）
| プロファイル | distribution | 用途 |
|-------------|-------------|------|
| development | internal | 開発ビルド（DevClient） |
| preview | internal | 内部テスト |
| testflight | store | TestFlight配布 |
| production | store | ストアリリース |

---

## 17. TestFlightデプロイ手順

### 必要な手順

```
1. eas build --platform ios --profile testflight
2. eas submit --platform ios --latest
3. App Store Connect → TestFlight → テスター招待
4. クライアントがTestFlightアプリからインストール
```

### テスター種別

| 種別 | 上限 | 審査 | 対象 |
|------|------|------|------|
| 内部テスター | 100人 | 不要 | 開発チーム |
| 外部テスター | 10,000人 | 初回のみ | クライアント・ベータユーザー |

---

## 18. クライアントからの必要事項

### 必須（開発側で必要）

| 項目 | 理由 | 備考 |
|------|------|------|
| Apple Developer Program 加入（年$99） | iOS ビルド・TestFlight・App Store 公開に必須 | 開発者アカウントとして登録 |
| Apple ID（メールアドレス） | App Store Connect アクセス、証明書管理 | Developer Program 登録時に使用 |
| Google Play Console アカウント（$25 一回） | Android アプリ公開に必須 | |
| LINE Developers チャネル情報 | LINE ログイン用 | チャネルID: 設定済み |
| Google Cloud Console クライアントID | Google ログイン用 | iOS / Android / Web 各設定 |

### TestFlight テスト参加時に必要（クライアント側）

| 項目 | 必須？ | 詳細 |
|------|--------|------|
| Apple ID | はい | TestFlight招待に必要（メールアドレスのみ共有） |
| iPhone / iPad | はい | TestFlightアプリをインストールして実機テスト |
| TestFlight アプリ | はい | App Storeから無料インストール |

### TestFlightを使わない場合の代替手段

| 方法 | Apple ID | iPhone | 備考 |
|------|----------|--------|------|
| 画面録画の共有 | 不要 | 不要 | 開発側が録画して送付 |
| Zoomライブデモ | 不要 | 不要 | 画面共有でリアルタイム確認 |
| Appetize.io | 不要 | 不要 | ブラウザ上でiOSシミュレーション（ウィジェット/Siri不可） |

### 追加機能に関する確認事項

| 機能 | 確認事項 | 回答欄 |
|------|----------|--------|
| 音声アシスタント | Phase 1 対応コマンド一覧の承認 | |
| ぴよログ移行 | 実際のエクスポートファイルの共有（1〜2件） | |
| ぴよログ移行 | 既存データとの「統合」or「上書き」 | |
| 授乳アラーム | デフォルト間隔（3時間）でよいか | |
| 授乳アラーム | Critical Alert（Apple特別申請）の要否 | |
| ウィジェット | 優先するウィジェットサイズ | |

---

## 19. 今後の対応事項と優先度

### Phase 1（優先度：高）

| 項目 | 状況 | 備考 |
|------|------|------|
| 授乳アラーム強化 | 実装済み（AlarmScreen） | 間隔設定・サウンド・自動スケジュール対応 |
| ぴよログデータ移行 | 実装済み（ImportScreen） | 3ステップウィザード、ドライラン対応 |
| 本番環境デプロイ | 検討中 | Railway / Render 等 |
| Google ログイン（Android） | 待ち | クライアントシークレット設定待ち |

### Phase 2（優先度：中）

| 項目 | 状況 | 備考 |
|------|------|------|
| 音声アシスタント連携 | ディープリンク実装済み | Siri/Google Assistantのネイティブ拡張が必要 |
| Apple ログイン テスト | 未実施 | iOSビルドが必要 |
| プッシュ通知 | SDK導入済み | サーバー側実装未着手 |

### Phase 3（優先度：低〜中）

| 項目 | 状況 | 備考 |
|------|------|------|
| ホーム画面ウィジェット | データ層実装済み（widgetCache） | iOS: WidgetKit / Android: Glance API のネイティブ実装が必要 |
| Amazon Alexa対応 | 未着手 | Phase 2以降 |
| パフォーマンス最適化 | 問題なし | 必要に応じて |

### 推奨実装順序

```
④ 授乳アラーム強化 → ③ ぴよログ移行 → ② 音声アシスタント → ① ウィジェット
```

---

## 20. 解決済みの技術的課題

| 課題 | 解決策 |
|------|--------|
| Google OAuth COOP問題 | Web: リダイレクト方式、ネイティブ: サーバーサイドリダイレクト |
| ngrok経由API接続 | 開発プロキシサーバーで単一トンネル化 |
| React Native Web互換性 | `Alert.alert()` → Web用フォールバック |
| 記録機能400エラー | 認証ストアからユーザーID取得に修正 |

---

## 21. アプリ設定情報

| 項目 | 値 |
|------|-----|
| App Name | We育 |
| Bundle ID (iOS) | com.weyuapp.app |
| Package (Android) | com.weyuapp.app |
| URL Scheme | weyu:// |
| EAS Project ID | a76dac5d-671d-4b95-be22-d5e4da3bea53 |
| Primary Color | #7C5CBF |
| Background | #F9F5FF |
| Orientation | Portrait |
| Tablet対応 | 無効 |

---

*本書はWe育モバイルアプリの全機能と技術仕様を網羅した最終テンプレートです。*
*実装状況は2026年4月9日時点のものです。最新の状態はソースコードおよびgit履歴をご確認ください。*
