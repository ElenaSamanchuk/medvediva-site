# -*- coding: utf-8 -*-
from pathlib import Path
import sys,json,re
sys.path.insert(0,'/Users/elena/Projects/qa-kit')
from qa_report import build
ROOT=Path(__file__).resolve().parents[1]
smoke=json.loads((ROOT/'docs/form-smoke.json').read_text())
rules=Path('/Users/elena/Projects/QA-ПРАВИЛА-Platformax.md').read_text()
kinds=[]
for m in re.finditer(r'^\| (\d+) \| \*\*(.+?)\*\* \|',rules,re.M):
 n=int(m[1]);name=m[2]
 if n in [1,2,7,9,10,12,14,22,31]: status='Частично: локальный компонент; build/тесты/Chromium 1440/390/320. Полный сайт не принят.'
 elif n in [3,15,21,23,24,25,26,27,28,30]: status='Вне текущей локальной формы; сайт/ЛК/приложения не перенесены и не проверены.'
 else: status='Не проверено: следующий этап после полного экспорта и реализации.'
 kinds.append([name,status])
D=dict(title='Medvediva — локальная форма и готовность миграции',short='Medvediva · локальный этап',date='09.10.2026',stand='127.0.0.1:5176 · отдельный workbench',subtitle='Только источник и автономная Vue-форма. Этот отчёт не подтверждает готовность публичного сайта к переносу или доставку обращений.',
 kpis=[(120,'URL sitemap','111 HTML сохранены'),(199,'кандидатов маршрутов','ссылки + robots + store'),(5,'тестов клиента','PASS; доставка не тестировалась'),(3,'ширины','1440/390/320 Chromium')],
 verdict=dict(stoppers=0,text='Локальные проверки формы пройдены. Полный сайт к выпуску не готов.',points=['Сборка Vue + Tailwind успешна; 5 тестов пройдены.','В двух независимых проверках validation/dry-run показали штатные сообщения.','На 1440/390/320 горизонтальной прокрутки и JS-ошибок не обнаружено; POST=0.','Экспорт/получатели формы/backend/весь сайт ещё не подтверждены.'],note='0 стопера в проверенном компоненте не означает разрешение выпуска сайта. Неизвестная доставка является незавершённым требованием, а не подтверждённым багом Tilda.'),
 matrix=dict(head=['Бренд / продукт','Desktop','Mobile web','ЛК/админки/приложения','DevTools'],rows=[['Medvediva: локальная форма','Chromium 1440, dry-run','390/320 touch DPR3','Не входят в перенос публичного компонента','0 POST, 0 pageerror, scrollWidth=width'],['Medvediva: весь публичный сайт','Исходники, не мигрирован','Эталон главной 390','ЛК: только внешние ссылки в источнике; вход не выполнялся','Полный аудит новой сборки не выполнен'],['Другие бренды/Platformax Admin','Вне задачи','Вне задачи','Не проверены: отдельные продукты','Не посещались']]),
 kinds=dict(head=['Вид QA','Объём и статус'],rows=kinds),bugs=[],design=[],
 works=[dict(id='W-1',status='ok',title='Валидация и безопасный dry-run',lead='Пустые обязательные поля показывают ошибки; корректные вымышленные данные показывают сообщение, что отправка не выполнена.',tech=['npm test: 5/5','npm run build: PASS','Chromium: 1440/390/320, mobile touch/DPR3','POST=0; pageerror=0; scrollWidth=viewport'],shots=[{'file':r['screenshot'].split('/')[-1],'cap':'Локальная форма; результат dry-run, доставка отключена'} for r in smoke['results']])],
 questions=[dict(id='Q-1',title='Свежий экспорт Tilda',lead='Подтверждённый архив не найден. Елена попробует скачать полный экспорт проекта 2075161.'),dict(id='Q-2',title='Доставка формы',lead='Текущие получатели и backend неизвестны; Елена подтвердила продолжение локального переноса. До настройки доставки форма остаётся dry-run/unconfigured.')],
 recommendations=['Сверить полный экспорт с current URL/датами/интеграциями перед переносом блоков.','Не публиковать workbench как новый сайт. Сначала главная как пилот с визуальной приёмкой.'],
 not_checked=['Полный сайт: визуальная идентичность, остальные маршруты/параметры/якоря и реальный 404.','Backend/доставка/consent/аналитика/chat/боты/платежи/ЛК. Никаких реальных лидов/денег.','Safari/WebKit/Firefox, tablet/landscape/реальные телефоны, нагрузка, полноценный security/a11y/SEO. Телефоны исключены поручением.','Сетевое отсутствие Tilda на всём будущем сайте; сейчас только текущий dist по статическому поиску не содержит подключения Tilda.','9 ошибок приобретения HTML не классифицированы как баги сайта.'],
 stand_state=['Публичный сайт, Tilda, DNS не изменялись.','Только вымышленные QA-данные в локальной форме. Данные не сохранены и не отправлены.'],
 tech=[('Сборка','index-DuCucz1O.js · index-DGoUKEAY.css'),('Проверки','docs/form-smoke.json; tests/support.test.mjs'),('Источники','sources/migration-manifest.json; docs/SOURCE-AUDIT.md'),('Ограничение','Готовность доставки/всего сайта не подтверждена')],footer='Отчёт локального этапа; полный QA — после реализации сайта.')
build(D,str(ROOT/'docs/2026-10-09-ОТЧЁТ-локальная-форма.html'),str(ROOT/'screens-local'))
md=['# Medvediva — локальная форма и готовность миграции','',D['verdict']['text'],'',D['subtitle'],'','## Проверено']
md+=['- '+x for x in D['verdict']['points']]
md+=['','## Виды QA','| Вид | Статус |','|---|---|']+['| '+a+' | '+b+' |' for a,b in kinds]
md+=['','## Сводка по проектам','| '+' | '.join(D['matrix']['head'])+' |','|---|---|---|---|---|']+['| '+' | '.join(r)+' |' for r in D['matrix']['rows']]
md+=['','## Находки','Подтверждённых багов в узком проверенном объёме нет; это не PASS полного сайта.','', '## Кадры']+['![Локальная форма](../'+r['screenshot']+')' for r in smoke['results']]
for label,key in [('Вопросы','questions'),('Рекомендации','recommendations'),('Не проверено','not_checked'),('Состояние данных','stand_state')]:
 md+=['','## '+label]
 md+=['- '+(x.get('lead','') if isinstance(x,dict) else x) for x in D[key]]
md+=['','## Технические доказательства','- docs/form-smoke.json: validation/dryRun PASS, 0 POST, 0 pageerror.','- npm test 5/5; npm run build PASS.','- HTML: qa-kit/qa_report.py; ширины/темы отчёта проверить перед передачей.','- Анализ зависимостей Endor: UNKNOWN, инструменты недоступны; см. DEPENDENCIES.md.']
(ROOT/'docs/2026-10-09-ОТЧЁТ-локальная-форма.md').write_text('\n'.join(md)+'\n')
