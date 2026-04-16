
Autocomplete Service API Validation Report
Score: 100/100
Findings: P0=0 P1=0 P2=0

Detected artifacts:
- fixtures/service/autocomplete-good.json: autocomplete-api (3 checks, 95%)

Detected checks:
- fixtures/service/autocomplete-good.json:checks[0]: autocomplete / Autocomplete query suggestions for shirts
- fixtures/service/autocomplete-good.json:checks[1]: top_items / Top items shown on empty search focus
- fixtures/service/autocomplete-good.json:checks[2]: trending_queries / Trending queries for placeholder or initial guidance

Live requests:
- Autocomplete query suggestions for shirts: 200 in 177ms / https://live.luigisbox.com/autocomplete/v2?tracker_id=757876-1071971&q=shirt&type=item%3A6%2Ccategory%3A3%2Cquery%3A5&hit_fields=title%2Cweb_url%2Cprice%2Cimage_link_l
- Top items shown on empty search focus: 200 in 153ms / https://live.luigisbox.com/v1/top_items?tracker_id=757876-1071971&type=item%3A5%2Ccategory%3A3&hit_fields=title%2Cweb_url%2Cprice%2Cimage_link_l
- Trending queries for placeholder or initial guidance: 200 in 138ms / https://live.luigisbox.com/v2/trending_queries?tracker_id=757876-1071971

No findings. Autocomplete service checks pass the current rule set.
