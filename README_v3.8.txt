BodyOS v3.8 統合修正版

・UGLABを最上位に維持
・長野式診断モジュール（脉状／腹診／火穴診／局所診）を復元
・処置候補は処置法名だけを表示し、採否は術者が選択
・画面上に「ちゃんペラ」の名称は表示しない
・初診／再診QR受付を維持
・再診は氏名＋生年月日で既存患者を照合
・患者データはアプリ外の ../Data/database.json と ../Data/reception.json に保存
・保存前に ../Data/Backup へ最大30世代バックアップ

起動：start-bodyos.bat
院内PC：http://localhost:3000
iPad等：起動画面に表示された http://院内PCのIP:3000

注意：GitHub Pagesでは画面確認のみ。QR受付と院内PC保存は start-bodyos.bat で起動した院内サーバーから利用してください。
