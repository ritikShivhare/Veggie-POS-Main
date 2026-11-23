# Marketing Preview ping

यह workflow केवल `https://aatmyam-marketing-preview.onrender.com/api/health` पर read-only HTTPS request भेजता है। हर पाँच मिनट का schedule है: `2-59/5 * * * *` (घंटे के 02, 07, 12, …, 57 मिनट)। इसे मूल GitHub repository की `main` branch से चलना है; forks में ping job नहीं चलेगा।

GitHub → Actions → **Aatmyam Marketing Preview Ping** पर परिणाम देखें। **Run workflow** से तुरंत जाँच कर सकते हैं। रोकने के लिए उसी workflow के menu में **Disable workflow** चुनें। किसी app deploy या restaurant login की जरूरत नहीं है।

इस check को कोई secret, app login या GitHub write permission नहीं चाहिए। यह order, payment या restaurant settings नहीं बदलता। HTTP failure, गलत JSON, Render loading page, या application/database not-ready response पर run fail होगा। Cold start के लिए दो retries हैं; प्रत्येक request अधिकतम 60 seconds और पूरा job अधिकतम 4 minutes है। Failed runs Actions में दिखेंगे; notification delivery आपके GitHub account की existing notification settings पर निर्भर है। कोई अलग email/SMS sender नहीं जोड़ा गया है।

## Free plan की सीमा

यह testing के लिए best-effort ping है; 24/7 उपलब्धता का वादा नहीं है। Render Free service 15 मिनट inbound traffic न मिलने पर sleep होती है। GitHub scheduled runs देर से चल सकते हैं या drop हो सकते हैं। Public repository में 60 दिन activity न होने पर GitHub scheduled workflows बंद कर सकता है। Workflow को re-enable करने पर schedule फिर चालू होता है।

Render workspace को हर calendar month में कुल 750 free instance hours मिलते हैं, जो सभी running Free web services में साझा होते हैं। एक service 30 दिन लगातार चले तो 720 hours, और 31 दिन चले तो 744 hours लगते हैं। दूसरी Free service का समय भी उसी allowance में जुड़ता है। Allowance खत्म होने पर Render Free services अगले महीने तक suspend हो सकती हैं। Free service को Render कभी भी restart कर सकता है।

Idle sleep हटाने के लिए इस web service का compute plan paid Starter या उससे ऊपर करना होगा; केवल workspace plan बदलना पर्याप्त नहीं है। 23 नवंबर 2026 को Render pricing में Starter compute $7/month है। इस बदलाव में कोई paid plan या paid cron job चालू नहीं किया गया है।

Sources (23 नवंबर 2026 को पढ़े गए):

- [Render Free instances](https://render.com/docs/free)
- [Render pricing](https://render.com/pricing)
- [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

## लागू करने से पहले की जाँच

Workflow YAML और Bash syntax सफल हैं। सात scenarios जाँचे गए: सही health response pass हुआ; loading HTML, not-ready status, unavailable database, JSON array, JSON null और HTTP failure सभी fail हुए। इसी workflow step को live Preview पर चलाने पर application और database healthy मिले। GitHub CI तथा manual workflow run की अंतिम स्थिति pull request और Actions history में देखें।
