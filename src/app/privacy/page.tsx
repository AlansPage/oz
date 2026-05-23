import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function PrivacyPage() {
  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4 border-b border-border bg-surface">
        <div className="justify-self-start">
          <Link href="/" className="oz-listing-back">
            <span className="oz-listing-back__arrow" aria-hidden>
              ←
            </span>
            <span>Назад</span>
          </Link>
        </div>
        <div className="justify-self-center flex items-center gap-2.5">
          <BrandMark size={28} />
          <span className="font-bold text-[16px] tracking-tight">öz</span>
        </div>
        <div className="justify-self-end" />
      </header>

      <section className="w-full max-w-[640px] mx-auto px-6 py-10">
        <h1 className="text-[22px] font-bold tracking-tight mb-2">
          Политика конфиденциальности
        </h1>
        <p className="text-[13px] text-text-3 mb-8">
          Действует с 23 мая 2026 года.
        </p>

        <div className="space-y-7 text-[14px] text-text leading-relaxed">
          <section>
            <h2 className="text-[16px] font-bold tracking-tight mb-2">
              1. Какие данные мы собираем
            </h2>
            <p>Чтобы öz работал, мы собираем и храним следующие данные:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2 text-text-2">
              <li>
                <span className="text-text font-medium">Номер телефона.</span>{" "}
                Обязателен для регистрации и входа. Используется как основной
                идентификатор аккаунта.
              </li>
              <li>
                <span className="text-text font-medium">Имя или никнейм.</span>{" "}
                Вы указываете его сами. Видно другим пользователям.
              </li>
              <li>
                <span className="text-text font-medium">
                  Фотография профиля (аватар).
                </span>{" "}
                Загружается по желанию. Видна другим пользователям.
              </li>
              <li>
                <span className="text-text font-medium">
                  Документы, подтверждающие личность.
                </span>{" "}
                Загружаются по желанию, если вы хотите получить статус
                подтверждённого пользователя. Видны только сотрудникам öz,
                проверяющим заявку.
              </li>
              <li>
                <span className="text-text font-medium">
                  Данные объявлений.
                </span>{" "}
                Суммы, направление обмена, желаемый курс, комментарии — всё, что
                вы указываете при публикации объявления.
              </li>
              <li>
                <span className="text-text font-medium">Данные сделок.</span>{" "}
                Информация о начатых сделках, их статусе, об отказах и спорах.
              </li>
              <li>
                <span className="text-text font-medium">
                  Чеки о переводах.
                </span>{" "}
                Изображения, которые вы загружаете в качестве подтверждения
                перевода. Видны только участникам сделки и сотрудникам öz при
                разборе споров.
              </li>
              <li>
                <span className="text-text font-medium">Сообщения в чате.</span>{" "}
                Текст переписки между участниками сделки.
              </li>
              <li>
                <span className="text-text font-medium">
                  Оценки и репутация.
                </span>{" "}
                Числовой рейтинг, количество завершённых сделок, отзывы.
              </li>
              <li>
                <span className="text-text font-medium">Связь с Telegram.</span>{" "}
                Идентификатор пользователя Telegram и его имя пользователя, если
                вы подключили свой аккаунт Telegram к öz для получения кодов
                входа и уведомлений.
              </li>
              <li>
                <span className="text-text font-medium">
                  IP-адрес и базовые сведения об устройстве.
                </span>{" "}
                Используются для защиты от мошенничества и злоупотреблений.
              </li>
              <li>
                <span className="text-text font-medium">
                  Настройки уведомлений и история их доставки.
                </span>{" "}
                Чтобы вы получали именно те оповещения, которые хотите, и не
                получали лишних.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-bold tracking-tight mb-2">
              2. Зачем мы собираем эти данные
            </h2>
            <p>Мы используем эти данные, чтобы:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-text-2">
              <li>вы могли войти в сервис и пользоваться им;</li>
              <li>подбирать объявления, подходящие друг другу;</li>
              <li>помогать пользователям оценивать надёжность контрагентов;</li>
              <li>предотвращать мошенничество, спам и злоупотребления;</li>
              <li>разбирать спорные сделки;</li>
              <li>выполнять требования закона, если они применимы;</li>
              <li>улучшать сервис на основе обезличенной статистики.</li>
            </ul>
            <p className="mt-3">
              Мы не используем ваши данные для показа рекламы и не передаём их
              рекламным площадкам.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-bold tracking-tight mb-2">
              3. Кто видит ваши данные
            </h2>
            <ul className="list-disc pl-5 mt-1 space-y-2 text-text-2">
              <li>
                <span className="text-text font-medium">Номер телефона.</span>{" "}
                Другие пользователи видят его в замаскированном виде (например,
                +7 *** *** ** 47). Полный номер виден только вам и сотрудникам
                öz.
              </li>
              <li>
                <span className="text-text font-medium">Имя и аватар.</span>{" "}
                Видны всем авторизованным пользователям сервиса — это сделано
                специально, чтобы участники сделки могли узнавать друг друга.
              </li>
              <li>
                <span className="text-text font-medium">
                  Рейтинг и количество сделок.
                </span>{" "}
                Видны всем авторизованным пользователям.
              </li>
              <li>
                <span className="text-text font-medium">
                  Содержимое объявлений.
                </span>{" "}
                Видно всем авторизованным пользователям, пока объявление
                активно.
              </li>
              <li>
                <span className="text-text font-medium">Детали сделки.</span>{" "}
                Видны только двум её участникам и сотрудникам öz.
              </li>
              <li>
                <span className="text-text font-medium">
                  Чеки о переводах.
                </span>{" "}
                Видны только двум участникам сделки и сотрудникам öz при
                разборе спора.
              </li>
              <li>
                <span className="text-text font-medium">Сообщения в чате.</span>{" "}
                Видны только двум участникам сделки и сотрудникам öz при
                разборе спора.
              </li>
              <li>
                <span className="text-text font-medium">
                  Документы, подтверждающие личность.
                </span>{" "}
                Видны только сотрудникам öz, рассматривающим заявку на
                верификацию.
              </li>
              <li>
                <span className="text-text font-medium">
                  IP-адрес и сведения об устройстве.
                </span>{" "}
                Видны только сотрудникам öz.
              </li>
            </ul>
            <p className="mt-3">
              Доступ сотрудников öz к перепискам, чекам и личным данным
              предоставляется только в рамках разбора жалоб, споров и подозрений
              в мошенничестве и фиксируется в служебных журналах.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-bold tracking-tight mb-2">
              4. Где хранятся данные
            </h2>
            <p>
              Данные хранятся в инфраструктуре Supabase, размещённой в
              дата-центрах региона Korea (Seoul, ap-northeast-2). Это значит,
              что физически серверы расположены в Республике Корея.
            </p>
            <p className="mt-2">
              За пределы этой инфраструктуры данные передаются только в
              следующих случаях:
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-text-2">
              <li>
                сообщения для авторизации и уведомления отправляются через
                серверы Telegram — это необходимо, чтобы вы получили код входа в
                Telegram;
              </li>
              <li>
                запросы к публичным источникам курсов валют (для отображения
                справочного рыночного курса) — при этом никакие ваши
                персональные данные не передаются;
              </li>
              <li>
                если правоохранительные органы Республики Корея или Республики
                Казахстан запросят данные в установленном законом порядке.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-bold tracking-tight mb-2">
              5. Как долго мы храним данные
            </h2>
            <ul className="list-disc pl-5 mt-1 space-y-2 text-text-2">
              <li>
                <span className="text-text font-medium">Активный аккаунт.</span>{" "}
                Пока существует аккаунт.
              </li>
              <li>
                <span className="text-text font-medium">
                  Неактивный аккаунт.
                </span>{" "}
                Не менее 2 лет после последней активности — для возможного
                разбирательства споров и противодействия мошенничеству. По
                истечении этого срока данные либо обезличиваются, либо
                удаляются.
              </li>
              <li>
                <span className="text-text font-medium">
                  Записи о сделках, включая чеки.
                </span>{" "}
                Не менее 5 лет с момента сделки. Это необходимо для возможного
                разбирательства споров и для соответствия требованиям, которые
                могут быть предъявлены налоговыми органами. Записи о сделках
                сохраняются даже после удаления аккаунта.
              </li>
              <li>
                <span className="text-text font-medium">
                  Журнал событий безопасности.
                </span>{" "}
                Не менее 2 лет.
              </li>
              <li>
                <span className="text-text font-medium">
                  Удалённый аккаунт.
                </span>{" "}
                Профиль и связанные с ним персональные данные (имя, аватар,
                телефон) удаляются из активной базы данных. Записи о
                завершённых сделках с участием этого аккаунта сохраняются по
                правилам выше, но привязываются к обезличенному идентификатору.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-bold tracking-tight mb-2">
              6. Ваши права
            </h2>
            <p>Вы имеете право:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-text-2">
              <li>получить копию своих данных, хранящихся в öz;</li>
              <li>исправить неточные данные;</li>
              <li>
                удалить свой аккаунт (с учётом сроков хранения, указанных в
                разделе 5);
              </li>
              <li>получить выгрузку своих данных в машиночитаемом формате;</li>
              <li>
                отозвать согласие на хранение необязательных данных — например,
                удалить загруженный документ, удостоверяющий личность, или
                отключить аккаунт Telegram.
              </li>
            </ul>
            <p className="mt-3">
              Чтобы воспользоваться любым из этих прав, напишите нам по адресу{" "}
              <a
                href="mailto:hello@oz.exchange"
                className="underline decoration-text-3 underline-offset-2"
              >
                hello@oz.exchange
              </a>
              . Мы постараемся ответить в разумный срок — обычно в течение 30
              дней.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-bold tracking-tight mb-2">
              7. Передача данных третьим лицам
            </h2>
            <p>
              Мы не продаём ваши данные и не передаём их в рекламных целях.
            </p>
            <p className="mt-3">
              Мы передаём данные следующим организациям только в той мере, в
              какой это необходимо для работы сервиса:
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-text-2">
              <li>
                <span className="text-text font-medium">Supabase</span> —
                хранение и обработка данных в нашей инфраструктуре;
              </li>
              <li>
                <span className="text-text font-medium">Telegram</span> —
                доставка кодов авторизации и уведомлений тем пользователям,
                которые подключили Telegram;
              </li>
              <li>
                <span className="text-text font-medium">
                  Поставщики курсов валют
                </span>{" "}
                — без передачи персональных данных, только агрегированные
                запросы.
              </li>
            </ul>
            <p className="mt-3">
              Кроме того, мы можем передать ваши данные:
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-text-2">
              <li>правоохранительным органам, если этого требует закон;</li>
              <li>
                в рамках расследования мошенничества или серьёзных нарушений
                условий использования öz;
              </li>
              <li>
                по судебному или регулятивному запросу, оформленному в
                установленном законом порядке.
              </li>
            </ul>
            <p className="mt-3">
              В таких случаях мы передаём только те данные, которые
              непосредственно относятся к запросу.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-bold tracking-tight mb-2">
              8. Безопасность
            </h2>
            <p>Мы принимаем следующие меры для защиты ваших данных:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-text-2">
              <li>
                шифрование данных при передаче (HTTPS / TLS) и шифрование
                носителей в дата-центре;
              </li>
              <li>
                разграничение доступа на уровне базы данных (Row Level Security
                в Supabase): обычный пользователь не может прочитать данные
                другого пользователя через клиент;
              </li>
              <li>
                чеки о переводах хранятся в приватном хранилище с ограниченным
                доступом;
              </li>
              <li>
                административный доступ имеют только операторы платформы и
                используют его исключительно в служебных целях;
              </li>
              <li>
                мониторинг подозрительных событий через служебный журнал
                безопасности.
              </li>
            </ul>
            <p className="mt-3">
              Тем не менее, ни одна система не является абсолютно защищённой.
              Мы рекомендуем вам также соблюдать базовые правила безопасности:
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-text-2">
              <li>
                не передавайте никому код авторизации, который пришёл вам в
                Telegram;
              </li>
              <li>
                не сообщайте никому полные реквизиты карт, CVV и пароли от
                банковских приложений;
              </li>
              <li>
                если кто-то от имени öz просит у вас деньги или коды — это
                мошенник; öz никогда так не делает.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-bold tracking-tight mb-2">
              9. Дети
            </h2>
            <p>
              Сервис не предназначен для лиц младше 18 лет. Мы сознательно не
              собираем данные о несовершеннолетних. Если нам станет известно,
              что аккаунт был зарегистрирован несовершеннолетним, мы удалим его
              и связанные с ним данные.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-bold tracking-tight mb-2">
              10. Cookies и аналитика
            </h2>
            <p>
              Мы используем минимальный набор cookies, необходимый для работы
              сервиса:
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-text-2">
              <li>
                сессионные cookies для поддержания входа в аккаунт
                (устанавливаются Supabase);
              </li>
              <li>
                технические cookies, нужные для корректной работы интерфейса.
              </li>
            </ul>
            <p className="mt-3">
              Мы не используем сторонние рекламные cookies, пиксели отслеживания
              и аналитику с поведенческим профилированием. Серверные журналы
              (включая логи Vercel и Supabase) ведутся в технических целях и не
              применяются для построения рекламных профилей пользователей.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-bold tracking-tight mb-2">
              11. Изменения политики
            </h2>
            <p>
              Мы можем менять эту политику. Если изменения существенно влияют
              на ваши права, мы уведомим вас об этом — в сервисе, по email или
              через Telegram. Менее существенные правки (например, уточнения
              формулировок) могут быть внесены без отдельного уведомления;
              актуальная редакция всегда доступна на этой странице.
            </p>
            <p className="mt-2">
              Если вы продолжаете пользоваться сервисом после уведомления,
              считается, что вы приняли изменения.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-bold tracking-tight mb-2">
              12. Контакт
            </h2>
            <p>
              По вопросам, связанным с этой политикой, по запросам на получение
              или удаление данных и по жалобам напишите нам:{" "}
              <a
                href="mailto:hello@oz.exchange"
                className="underline decoration-text-3 underline-offset-2"
              >
                hello@oz.exchange
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-border text-[12px] text-text-3 space-y-1">
          <p>Последнее обновление: 23 мая 2026</p>
          <p>
            Если у вас есть вопросы, напишите нам:{" "}
            <a
              href="mailto:hello@oz.exchange"
              className="underline decoration-text-3 underline-offset-2"
            >
              hello@oz.exchange
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
