import { ApiError } from '../middleware/error_handler';

/**
 * Regex để phát hiện URL trong tin nhắn
 * Dùng để bảo vệ URL khỏi các quy tắc kiểm tra khác
 * Hỗ trợ cả URL có @, URL dài với các ký tự đặc biệt
 */
const URL_REGEX = /(@?https?:\/\/[^\s]+)/gi;

/**
 * Regex kiểm tra ký tự hợp lệ
 * Chỉ cho phép chữ cái, số, dấu câu, khoảng trắng và một số ký tự đặc biệt
 */
const VALID_CHARS_REGEX = /^[\p{L}\p{N}\p{P}\p{Zs}\p{So}\p{Mn}\p{Mc}]+$/u;

/**
 * Regex phát hiện quá nhiều dấu nguyên âm, có thể là spam
 * Phát hiện các dấu/ký tự diacritical lặp lại quá 10 lần
 */
const EXCESSIVE_DIACRITICS_REGEX = /[\u0300-\u036F\u0483-\u0489\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]{10,}/;

/**
 * Giới hạn độ dài tin nhắn
 */
const MAX_MESSAGE_LENGTH = 1000;

/**
 * Kiểm tra ký tự lặp lại quá nhiều lần liên tiếp
 * @param text Chuỗi cần kiểm tra
 * @param max_repeats Số lần lặp lại tối đa cho phép
 */
const has_excessive_repeats = (text: string, max_repeats: number = 5): boolean => {
  // Tạo regex kiểm tra ký tự lặp lại
  const repeated_char_regex = new RegExp(`(.)\\1{${max_repeats},}`, 'u');
  return repeated_char_regex.test(text);
};

/**
 * Kiểm tra từ lặp lại quá nhiều lần liên tiếp
 * @param text Chuỗi cần kiểm tra
 * @param max_repeats Số lần lặp lại tối đa cho phép
 */
const has_repeated_words = (text: string, max_repeats: number = 3): boolean => {
  // Tách chuỗi thành mảng các từ
  const words = text.toLowerCase().split(/\s+/);
  
  // Đếm số lần lặp lại liên tiếp
  let current_word = '';
  let repeat_count = 1;
  
  for (let i = 0; i < words.length; i++) {
    if (words[i] === current_word) {
      repeat_count++;
      if (repeat_count > max_repeats) return true;
    } else {
      current_word = words[i];
      repeat_count = 1;
    }
  }
  
  return false;
};

/**
 * Thay thế tạm thời các URL trong tin nhắn để chúng không bị ảnh hưởng bởi validator
 * @param message Tin nhắn cần xử lý
 * @returns Object chứa tin nhắn đã xử lý và mảng URL gốc
 */
const extract_urls = (message: string): { processed_message: string, urls: string[] } => {
  const urls: string[] = [];
  const processed_message = message.replace(URL_REGEX, (match) => {
    urls.push(match);
    console.log(`URL được phát hiện và bảo vệ: ${match}`);
    return `[URL_${urls.length - 1}]`;
  });
  
  if (urls.length > 0) {
    console.log(`Đã trích xuất ${urls.length} URL từ tin nhắn.`);
  }
  
  return { processed_message, urls };
};

/**
 * Khôi phục các URL đã thay thế trước đó
 * @param processed_message Tin nhắn đã xử lý
 * @param urls Mảng URL gốc
 * @returns Tin nhắn hoàn chỉnh với các URL gốc
 */
const restore_urls = (processed_message: string, urls: string[]): string => {
  let restored = processed_message;
  for (let i = 0; i < urls.length; i++) {
    restored = restored.replace(`[URL_${i}]`, urls[i]);
    console.log(`URL đã được khôi phục: ${urls[i]}`);
  }
  
  if (urls.length > 0) {
    console.log(`Đã khôi phục ${urls.length} URL trong tin nhắn.`);
  }
  
  return restored;
};

/**
 * Validator chính cho tin nhắn
 * @param message Tin nhắn cần kiểm tra
 * @throws ApiError nếu tin nhắn không hợp lệ
 */
export const validate_message = (message: string): void => {
  // Kiểm tra message không bị null hoặc undefined
  if (!message || typeof message !== 'string') {
    throw new ApiError('Nội dung tin nhắn không hợp lệ', 400);
  }
  
  // Kiểm tra độ dài tin nhắn
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new ApiError(`Tin nhắn không được vượt quá ${MAX_MESSAGE_LENGTH} ký tự`, 400);
  }
  
  // Kiểm tra tin nhắn rỗng hoặc chỉ có khoảng trắng
  if (message.trim().length === 0) {
    throw new ApiError('Tin nhắn không được để trống', 400);
  }
  
  // Trích xuất URL trước khi kiểm tra
  const { processed_message, urls } = extract_urls(message);
  
  // Kiểm tra ký tự lặp lại quá nhiều
  if (has_excessive_repeats(processed_message)) {
    throw new ApiError('Tin nhắn chứa quá nhiều ký tự lặp lại', 400);
  }
  
  // Kiểm tra từ lặp lại quá nhiều
  if (has_repeated_words(processed_message)) {
    throw new ApiError('Tin nhắn chứa quá nhiều từ lặp lại liên tiếp', 400);
  }
  
  // Kiểm tra regex dấu nhiều
  if (EXCESSIVE_DIACRITICS_REGEX.test(processed_message)) {
    throw new ApiError('Tin nhắn chứa quá nhiều dấu', 400);
  }
  
  // Kiểm tra ký tự hợp lệ - chỉ áp dụng cho phần không phải URL
  if (!VALID_CHARS_REGEX.test(processed_message)) {
    throw new ApiError('Tin nhắn chứa ký tự không hợp lệ', 400);
  }
};

/**
 * Kiểm tra nhanh tin nhắn, trả về kết quả thay vì throw error
 * Hữu ích trong trường hợp muốn kiểm tra nhanh mà không cần xử lý exception
 */
export const is_valid_message = (message: string): boolean => {
  try {
    validate_message(message);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Tạo bản tin nhắn an toàn (loại bỏ các yếu tố không an toàn)
 * @param message Tin nhắn gốc
 * @returns Tin nhắn đã được làm sạch
 */
export const sanitize_message = (message: string): string => {
  if (!message || typeof message !== 'string') {
    return '';
  }
  
  // Cắt bớt nếu quá dài
  let sanitized = message.slice(0, MAX_MESSAGE_LENGTH);
  
  // Trích xuất URL trước khi làm sạch
  const { processed_message, urls } = extract_urls(sanitized);
  
  // Xóa các ký tự không hợp lệ
  let cleaned = processed_message.replace(/[^\p{L}\p{N}\p{P}\p{Zs}\p{So}\p{Mn}\p{Mc}]/gu, '');
  
  // Xử lý ký tự lặp lại
  cleaned = cleaned.replace(/(.)\1{5,}/gu, (match, char) => char.repeat(5));
  
  // Khôi phục URL
  sanitized = restore_urls(cleaned, urls);
  
  return sanitized.trim();
}; 