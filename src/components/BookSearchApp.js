import React, { useState, useEffect, useMemo } from 'react';
import { Search, Book, MapPin, Tag, BookOpen, Star } from 'lucide-react';
import { booksData } from '../data/books.js';
import { branchesData } from '../data/branches.js';

const BookSearchApp = () => {
  const [books, setBooks] = useState([]);
  const [branches, setBranches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSubTheme, setSelectedSubTheme] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setBranches(branchesData);
      setBooks(booksData);
      setLoading(false);
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      const matchesSearch = searchTerm === '' || 
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.publisher.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesBranch = selectedBranch === '' || book.branch === selectedBranch;
      const matchesSubTheme = selectedSubTheme === '' || book.subTheme === selectedSubTheme;
      
      return matchesSearch && matchesBranch && matchesSubTheme;
    });
  }, [books, searchTerm, selectedBranch, selectedSubTheme]);

  const availableSubThemes = useMemo(() => {
    if (!selectedBranch) return [];
    const branch = branches.find(b => b.branch === selectedBranch);
    return branch ? branch.subThemes : [];
  }, [branches, selectedBranch]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center text-red-600">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">지관서가</h1>
            <p className="text-gray-600">북카페 도서검색</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* 검색 및 필터 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="space-y-6">
            {/* 검색바 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="도서명, 저자명, 출판사로 검색하세요"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            
            {/* 지점(인생테마) 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <MapPin className="inline h-4 w-4 mr-1" />
                지점(인생테마)
              </label>
              <div className="flex overflow-x-auto gap-2 pb-2">
                <button
                  onClick={() => {
                    setSelectedBranch('');
                    setSelectedSubTheme('');
                  }}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedBranch === '' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                {branches.map((branch, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedBranch(branch.branch);
                      setSelectedSubTheme('');
                    }}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedBranch === branch.branch 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {branch.branch}({branch.lifeTheme})
                  </button>
                ))}
              </div>
            </div>
            
            {/* 소분류 필터 */}
            {selectedBranch && availableSubThemes.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Tag className="inline h-4 w-4 mr-1" />
                  소분류
                </label>
                <div className="flex overflow-x-auto gap-2 pb-2">
                  <button
                    onClick={() => setSelectedSubTheme('')}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedSubTheme === '' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  {availableSubThemes.map((subTheme, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedSubTheme(subTheme)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedSubTheme === subTheme 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {subTheme}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* 초기화 버튼 */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedBranch('');
                  setSelectedSubTheme('');
                }}
                className="px-6 py-2 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                필터 초기화
              </button>
            </div>
          </div>

          {/* 검색 결과 수 */}
          <div className="mt-4 pt-4 border-t text-sm text-gray-600">
            총 {filteredBooks.length}권의 도서가 검색되었습니다.
          </div>
        </div>

        {/* 도서 목록 */}
        <div className="space-y-4">
          {filteredBooks.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">검색 결과가 없습니다</h3>
              <p className="text-gray-600">다른 검색어나 필터를 시도해보세요.</p>
            </div>
          ) : (
            filteredBooks.map((book, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* 도서 정보 */}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      <Book className="inline h-5 w-5 mr-2 text-indigo-600" />
                      {book.title}
                    </h3>
                    <p className="text-gray-700 mb-1">
                      <strong>저자:</strong> {book.author}
                    </p>
                    <p className="text-gray-700 mb-1">
                      <strong>출판사:</strong> {book.publisher}
                    </p>
                    <p className="text-gray-700 mb-3">
                      <strong>출간년도:</strong> {book.year}
                    </p>
                    
                    {/* 위치 및 테마 정보 */}
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        <MapPin className="h-3 w-3 mr-1" />
                        {book.branch}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                        <Tag className="h-3 w-3 mr-1" />
                        {book.theme}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        <Star className="h-3 w-3 mr-1" />
                        {book.subTheme}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 푸터 */}
        <footer className="mt-12 text-center text-gray-600">
          <p className="mb-2">지관서가 북카페</p>
          <p className="text-sm">총 11개 지점 | 7,733권의 큐레이션된 도서</p>
          <p className="text-sm">QR코드를 통해 접속하셨네요! 원하는 도서를 찾아보세요.</p>
        </footer>
      </main>
    </div>
  );
};

export default BookSearchApp;
