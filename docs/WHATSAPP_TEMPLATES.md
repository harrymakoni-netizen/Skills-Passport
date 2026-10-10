# WhatsApp message templates

Generated from `packages/core/src/templates.ts` and the i18n catalogue by `pnpm --filter @sp/core templates:doc` — do not
edit by hand. Submit each template to Meta (WhatsApp Manager → Message templates) in the **Utility** category.

Meta does not offer chiShona or isiNdebele as template languages, so those versions are submitted under the **English
(en)** locale with a language suffix on the name (`…_sn`, `…_nd`). The adapter picks the right name automatically
(`templateNameAndLocale` in `packages/adapters/src/messaging/whatsapp.ts`).

Parameters are `{{1}}`, `{{2}}`… in order. Quick-reply button payloads are set at send time as `<payload>:<id>`.
chiShona and isiNdebele wording is a draft for native-speaker review before submission.

## `sp_client_job_confirmation_v1`

Parameters: `{{1}}` artisan_first_name, `{{2}}` job_type, `{{3}}` job_date, `{{4}}` rating_link

| Language | Template name | Body | Quick replies |
| --- | --- | --- | --- |
| English | `sp_client_job_confirmation_v1` | Skills Passport: {{1}} says they did '{{2}}' for you on {{3}}. Was this work done?<br>Rate the work and see photos: {{4}}<br>Reply with a button below. | Yes, it was done (`cc_yes`)<br>No (`cc_no`)<br>Stop messages (`cc_stop`) |
| chiShona | `sp_client_job_confirmation_v1_sn` | Skills Passport: {{1}} vanoti vakakuitirai '{{2}}' musi wa{{3}}. Basa iri rakaitwa here?<br>Pai mamaki uye muone mifananidzo: {{4}}<br>Pindurai nebhatani riri pazasi. | Hongu, rakaitwa (`cc_yes`)<br>Kwete (`cc_no`)<br>Misa mameseji (`cc_stop`) |
| isiNdebele | `sp_client_job_confirmation_v1_nd` | Skills Passport: u-{{1}} uthi ukwenzele '{{2}}' ngo-{{3}}. Umsebenzi lo wenziwe yini?<br>Nika amamaki ubone imifanekiso: {{4}}<br>Phendula ngenkinobho engezansi. | Yebo, wenziwe (`cc_yes`)<br>Hatshi (`cc_no`)<br>Misa imilayezo (`cc_stop`) |

## `sp_client_job_reminder_v1`

Parameters: `{{1}}` artisan_first_name, `{{2}}` job_type, `{{3}}` job_date, `{{4}}` rating_link

| Language | Template name | Body | Quick replies |
| --- | --- | --- | --- |
| English | `sp_client_job_reminder_v1` | Reminder from Skills Passport: {{1}} says they did '{{2}}' for you on {{3}}. Was this work done?<br>Rate the work: {{4}}<br>Reply with a button below. | Yes, it was done (`cc_yes`)<br>No (`cc_no`)<br>Stop messages (`cc_stop`) |
| chiShona | `sp_client_job_reminder_v1_sn` | Chiyeuchidzo kubva kuSkills Passport: {{1}} vanoti vakakuitirai '{{2}}' musi wa{{3}}. Basa iri rakaitwa here?<br>Pai mamaki: {{4}}<br>Pindurai nebhatani riri pazasi. | Hongu, rakaitwa (`cc_yes`)<br>Kwete (`cc_no`)<br>Misa mameseji (`cc_stop`) |
| isiNdebele | `sp_client_job_reminder_v1_nd` | Isikhumbuzo esivela ku-Skills Passport: u-{{1}} uthi ukwenzele '{{2}}' ngo-{{3}}. Umsebenzi lo wenziwe yini?<br>Nika amamaki: {{4}}<br>Phendula ngenkinobho engezansi. | Yebo, wenziwe (`cc_yes`)<br>Hatshi (`cc_no`)<br>Misa imilayezo (`cc_stop`) |

## `sp_artisan_job_update_v1`

Parameters: `{{1}}` job_ref, `{{2}}` status_text

| Language | Template name | Body | Quick replies |
| --- | --- | --- | --- |
| English | `sp_artisan_job_update_v1` | Skills Passport: update on job {{1}}. {{2}}<br>Tap below to open your passport. | My passport (`menu_passport`) |
| chiShona | `sp_artisan_job_update_v1_sn` | Skills Passport: nhau dzebasa {{1}}. {{2}}<br>Dzvanyai pazasi kuti muone passport yenu. | Passport yangu (`menu_passport`) |
| isiNdebele | `sp_artisan_job_update_v1_nd` | Skills Passport: okutsha ngomsebenzi {{1}}. {{2}}<br>Thinta ngezansi ukuze ubone i-passport yakho. | I-passport yami (`menu_passport`) |

## `sp_artisan_review_result_v1`

Parameters: `{{1}}` job_ref, `{{2}}` result_text

| Language | Template name | Body | Quick replies |
| --- | --- | --- | --- |
| English | `sp_artisan_review_result_v1` | Skills Passport: job {{1}} was reviewed. {{2}}<br>Tap below to open your passport. | My passport (`menu_passport`) |
| chiShona | `sp_artisan_review_result_v1_sn` | Skills Passport: basa {{1}} raongororwa. {{2}}<br>Dzvanyai pazasi kuti muone passport yenu. | Passport yangu (`menu_passport`) |
| isiNdebele | `sp_artisan_review_result_v1_nd` | Skills Passport: umsebenzi {{1}} uhloliwe. {{2}}<br>Thinta ngezansi ukuze ubone i-passport yakho. | I-passport yami (`menu_passport`) |

## `sp_artisan_work_request_v1`

Parameters: `{{1}}` buyer_name, `{{2}}` area, `{{3}}` description

| Language | Template name | Body | Quick replies |
| --- | --- | --- | --- |
| English | `sp_artisan_work_request_v1` | Skills Passport: new work request from {{1}} in {{2}}: {{3}}<br>Reply with a button below. | Accept (`wr_accept`)<br>Decline (`wr_decline`) |
| chiShona | `sp_artisan_work_request_v1_sn` | Skills Passport: chikumbiro chitsva chebasa kubva ku{{1}} mu{{2}}: {{3}}<br>Pindurai nebhatani riri pazasi. | Bvuma (`wr_accept`)<br>Ramba (`wr_decline`) |
| isiNdebele | `sp_artisan_work_request_v1_nd` | Skills Passport: isicelo esitsha somsebenzi esivela ku-{{1}} e-{{2}}: {{3}}<br>Phendula ngenkinobho engezansi. | Vuma (`wr_accept`)<br>Ala (`wr_decline`) |

## `sp_artisan_job_ownership_v1`

Parameters: `{{1}}` agent_name, `{{2}}` job_type, `{{3}}` job_ref

| Language | Template name | Body | Quick replies |
| --- | --- | --- | --- |
| English | `sp_artisan_job_ownership_v1` | Skills Passport: field agent {{1}} logged a '{{2}}' job for you ({{3}}). Is this your job? | Yes, it's mine (`own_yes`)<br>Not mine (`own_no`) |
| chiShona | `sp_artisan_job_ownership_v1_sn` | Skills Passport: mumiriri {{1}} anyora basa re'{{2}}' renyu ({{3}}). Iri ibasa renyu here? | Hongu, nderangu (`own_yes`)<br>Harisi rangu (`own_no`) |
| isiNdebele | `sp_artisan_job_ownership_v1_nd` | Skills Passport: umsebenzi wasendaweni u-{{1}} ubhalele wena umsebenzi we-'{{2}}' ({{3}}). Ngowakho yini? | Yebo, ngowami (`own_yes`)<br>Akusiwo owami (`own_no`) |

## `sp_hire_follow_up_v1`

Parameters: `{{1}}` other_party, `{{2}}` description

| Language | Template name | Body | Quick replies |
| --- | --- | --- | --- |
| English | `sp_hire_follow_up_v1` | Skills Passport: did the job with {{1}} happen? ({{2}}) | Yes, it happened (`hire_yes`)<br>No, it didn't (`hire_no`) |
| chiShona | `sp_hire_follow_up_v1_sn` | Skills Passport: basa na{{1}} rakaitika here? ({{2}}) | Hongu, rakaitika (`hire_yes`)<br>Kwete (`hire_no`) |
| isiNdebele | `sp_hire_follow_up_v1_nd` | Skills Passport: umsebenzi lo-{{1}} wenzekile yini? ({{2}}) | Yebo, wenzekile (`hire_yes`)<br>Hatshi (`hire_no`) |

