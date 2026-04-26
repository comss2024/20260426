// 알레르기 번호 매핑 (참고용)
// 1.난류, 2.우유, 3.메밀, 4.땅콩, 5.대두, 6.밀, 7.고등어, 8.게, 9.새우, 10.돼지고기, 11.복숭아, 12.토마토, 13.아황산류, 14.호두, 15.닭고기, 16.쇠고기, 17.오징어, 18.조개류, 19.잣

// 채식 단계별 피해야 할 동물성 알레르기 번호
const restrictedAllergies = {
    'vegan': [1, 2, 7, 8, 9, 10, 15, 16, 17, 18], // 완전 채식 (고기, 해산물, 유제품, 동물의 알 모두 배제)
    'lacto': [1, 7, 8, 9, 10, 15, 16, 17, 18],    // 우유 허용 (계란, 해산물, 고기 배제)
    'ovo': [2, 7, 8, 9, 10, 15, 16, 17, 18],      // 계란 허용 (우유, 해산물, 고기 배제)
    'lacto-ovo': [7, 8, 9, 10, 15, 16, 17, 18],   // 우유, 계란 허용 (해산물, 고기 배제)
    'pesco': [10, 15, 16],                        // 해산물, 유제품, 계란 허용 (가금류, 육류 배제)
    'pollo': [10, 16],                            // 가금류, 해산물, 유제품, 계란 허용 (붉은 고기 배제)
    'none': []                                    // 해당 없음
};

let currentSchool = { code: '9300116', officeCode: 'I10', name: '아름중학교' };
let currentDate = new Date(); // 현재 날짜 (기준 월)

const elements = {
    vegType: document.getElementById('vegType'),
    mealControls: document.getElementById('mealControls'),
    selectedSchoolInfo: document.getElementById('selectedSchoolInfo'),
    currentMonthLabel: document.getElementById('currentMonthLabel'),
    prevMonthBtn: document.getElementById('prevMonthBtn'),
    nextMonthBtn: document.getElementById('nextMonthBtn'),
    loading: document.getElementById('loading'),
    mealResults: document.getElementById('mealResults')
};

// 월간 식단 조회 함수
async function fetchMeals() {
    if (!currentSchool) return;

    const year = currentDate.getFullYear();
    const monthIndex = currentDate.getMonth();
    const month = String(monthIndex + 1).padStart(2, '0');
    const yyyymm = `${year}${month}`;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    
    elements.currentMonthLabel.textContent = `${year}년 ${month}월`;
    elements.loading.style.display = 'block';
    elements.mealResults.innerHTML = '';

    try {
        const fetchPromises = [];
        for (let day = 1; day <= lastDay; day++) {
            const dayStr = String(day).padStart(2, '0');
            const targetDate = `${yyyymm}${dayStr}`;
            const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=${currentSchool.officeCode}&SD_SCHUL_CODE=${currentSchool.code}&MLSV_YMD=${targetDate}`;
            fetchPromises.push(fetch(url).then(res => res.json()).catch(() => null));
        }

        const results = await Promise.all(fetchPromises);
        elements.loading.style.display = 'none';

        let allMeals = [];
        results.forEach(data => {
            if (data && data.mealServiceDietInfo && data.mealServiceDietInfo[1].row) {
                allMeals = allMeals.concat(data.mealServiceDietInfo[1].row);
            }
        });

        if (allMeals.length > 0) {
            renderMeals(allMeals);
        } else {
            elements.mealResults.innerHTML = `<div class="empty-state">${year}년 ${month}월의 급식 정보가 없습니다.</div>`;
        }
    } catch (error) {
        console.error('Error fetching meals:', error);
        elements.loading.style.display = 'none';
        elements.mealResults.innerHTML = '<div class="empty-state">급식 정보를 불러오는 중 오류가 발생했습니다.</div>';
    }
}

// 식단 데이터 렌더링
function renderMeals(meals) {
    elements.mealResults.innerHTML = '';
    const vegType = elements.vegType.value;
    const vegRestricted = restrictedAllergies[vegType] || [];
    
    // 선택된 알레르기 체크박스 값 가져오기
    const checkedAllergies = Array.from(document.querySelectorAll('input[name="allergy"]:checked')).map(cb => Number(cb.value));
    
    // 채식 단계 제한과 추가 알레르기 제한 병합 (중복 제거)
    const restricted = [...new Set([...vegRestricted, ...checkedAllergies])];

    meals.forEach(meal => {
        const dateStr = meal.MLSV_YMD; // "20260401"
        const formattedDate = `${dateStr.substring(0, 4)}.${dateStr.substring(4, 6)}.${dateStr.substring(6, 8)}`;
        
        // 메뉴명 분리 및 파싱 (예: "기장밥\n김치찌개(5.9.10.)")
        const dishItems = meal.DDISH_NM.split('<br/>');
        
        const card = document.createElement('div');
        card.className = 'meal-card';
        
        const dateHeader = document.createElement('div');
        dateHeader.className = 'meal-date';
        dateHeader.textContent = `${formattedDate} (${meal.MMEAL_SC_NM})`; // 날짜 (조식/중식/석식)

        const content = document.createElement('div');
        content.className = 'meal-content';
        
        const ul = document.createElement('ul');
        ul.className = 'meal-list';

        let hasWarningForMeal = false;
        let warningFoods = [];

        dishItems.forEach(dish => {
            // 요리명과 알레르기 번호 파싱
            // 예: "돼지고기김치찌개(5.9.10.)"
            let dishName = dish.replace(/\([\d\.]+\)/, '').trim();
            dishName = dishName.replace(/\*+/g, ''); // 별표 제거
            
            const li = document.createElement('li');
            
            // 알레르기 번호 추출
            const match = dish.match(/\(([\d\.]+)\)/);
            let isWarning = false;
            let currentAllergies = [];

            if (match) {
                // "5.9.10." -> [5, 9, 10]
                const numbers = match[1].split('.').filter(n => n !== '').map(Number);
                currentAllergies = numbers;
                
                // 제한 목록에 포함된 번호가 있는지 확인
                isWarning = numbers.some(num => restricted.includes(num));
            }

            if (isWarning) {
                hasWarningForMeal = true;
                warningFoods.push(dishName);
                li.innerHTML = `<span class="food-warning">${dishName}</span>`;
            } else {
                li.innerHTML = `<span>${dishName}</span>`;
            }
            
            ul.appendChild(li);
        });

        if (hasWarningForMeal) {
            dateHeader.classList.add('has-warning');
            dateHeader.innerHTML += ' <span style="font-size:0.8rem; background:rgba(0,0,0,0.2); padding:2px 6px; border-radius:10px;">주의</span>';
        }

        content.appendChild(ul);

        if (hasWarningForMeal) {
            const summary = document.createElement('div');
            summary.className = 'warning-summary';
            summary.textContent = `주의 요리: ${warningFoods.join(', ')}`;
            content.appendChild(summary);
        }

        card.appendChild(dateHeader);
        card.appendChild(content);
        elements.mealResults.appendChild(card);
    });
}

// 이벤트 리스너
elements.prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    fetchMeals();
});

elements.nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    fetchMeals();
});

elements.vegType.addEventListener('change', () => {
    fetchMeals();
});

const allergyCheckboxes = document.querySelectorAll('input[name="allergy"]');
allergyCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
        fetchMeals();
    });
});

// 초기 데이터 로드
fetchMeals();
